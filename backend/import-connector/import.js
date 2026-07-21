#!/usr/bin/env node
/**
 * Guarida — Generic Import Connector
 * ------------------------------------------------------------------
 * Purpose: let any org bring in whatever spreadsheet/CSV they already
 * use (people, donors, inventory) WITHOUT us knowing in advance what
 * that spreadsheet looks like. You tell it which columns mean what,
 * once, in a config file — the script does the rest.
 *
 * This is the "connect to an existing one" piece: Wet Noses (or any
 * future org) exports whatever they have to CSV, points this script
 * at it with a column mapping, and it lands in Guarida cleanly.
 *
 * Usage:
 *   node import.js --config ./configs/wetnoses-people.json
 *   node import.js --config ./configs/wetnoses-people.json --dry-run
 *
 * Supported entities: people | donors | inventory_items
 * (Cases are intentionally NOT importable this way — case history
 * should start fresh in Guarida, not be bulk-loaded from a spreadsheet
 * that was never structured for legal/medical recordkeeping.)
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Supabase client is only created if we're actually writing (not dry-run),
// so this script has zero external dependencies when you're just testing
// a mapping.
let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (_) {
  // fine — only needed for real writes
}

// ---------------------------------------------------------------------
// 1. CLI args
// ---------------------------------------------------------------------
function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.configPath = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  if (!args.configPath) {
    console.error('Usage: node import.js --config <path> [--dry-run]');
    process.exit(1);
  }
  return args;
}

// ---------------------------------------------------------------------
// 2. Config shape (this is what a person/agent writes per org):
// {
//   "entity": "people" | "donors" | "inventory_items",
//   "orgId": "uuid-of-the-org-in-guarida",
//   "csvPath": "./wetnoses_contacts.csv",
//   "mapping": {
//     "<guarida_field>": "<column header in their CSV>"
//   },
//   "defaultRole": "volunteer"   // only used for entity: "people"
// }
// ---------------------------------------------------------------------
function loadConfig(configPath) {
  const raw = fs.readFileSync(path.resolve(configPath), 'utf8');
  const config = JSON.parse(raw);
  const required = ['entity', 'orgId', 'csvPath', 'mapping'];
  for (const key of required) {
    if (!config[key]) throw new Error(`Config missing required field: ${key}`);
  }
  if (!['people', 'donors', 'inventory_items'].includes(config.entity)) {
    throw new Error(`Unsupported entity: ${config.entity}`);
  }
  return config;
}

// ---------------------------------------------------------------------
// 3. Field-level normalizers — kept separate from mapping so the same
//    cleanup logic applies no matter which column the org used.
// ---------------------------------------------------------------------
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;
  // Best-effort E.164: if there's no leading +, assume it needs one.
  // This is a heuristic, not a validator — flagged in the report below
  // so a human can fix ambiguous numbers rather than silently guessing.
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function normalizeEmail(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

function normalizeNumber(raw, fallback = 0) {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------
// 4. Row transformers per entity — map raw CSV row -> Guarida row,
//    using the config's column mapping.
// ---------------------------------------------------------------------
function transformPerson(row, mapping, orgId, defaultRole) {
  const get = (field) => row[mapping[field]];
  const full_name = get('full_name');
  if (!full_name) return { skip: true, reason: 'missing full_name' };

  return {
    skip: false,
    person: {
      full_name: String(full_name).trim(),
      email: normalizeEmail(get('email')),
      whatsapp_number: normalizePhone(get('whatsapp_number')),
    },
    membership: {
      org_id: orgId,
      role: get('role') || defaultRole || 'volunteer',
      status: 'active',
    },
  };
}

function transformDonor(row, mapping, orgId) {
  const get = (field) => row[mapping[field]];
  const name = get('name');
  if (!name) return { skip: true, reason: 'missing name' };

  return {
    skip: false,
    donor: {
      org_id: orgId,
      name: String(name).trim(),
      contact: get('contact') || null,
      donor_type: get('donor_type') || 'prospect',
      stage: get('stage') || 'prospect',
      notes: get('notes') || null,
    },
  };
}

function transformInventoryItem(row, mapping, orgId) {
  const get = (field) => row[mapping[field]];
  const name = get('name');
  if (!name) return { skip: true, reason: 'missing name' };

  return {
    skip: false,
    item: {
      org_id: orgId,
      name: String(name).trim(),
      category: get('category') || null,
      quantity: normalizeNumber(get('quantity'), 0),
      unit: get('unit') || null,
    },
  };
}

const TRANSFORMERS = {
  people: transformPerson,
  donors: transformDonor,
  inventory_items: transformInventoryItem,
};

// ---------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.configPath);

  const csvRaw = fs.readFileSync(path.resolve(config.csvPath), 'utf8');
  const parsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });

  if (parsed.errors.length) {
    console.error('CSV parse errors:');
    parsed.errors.forEach((e) => console.error(`  Row ${e.row}: ${e.message}`));
  }

  const rows = parsed.data;
  const report = { total: rows.length, imported: 0, skipped: [], flagged: [] };
  const toWrite = [];

  const transformer = TRANSFORMERS[config.entity];

  rows.forEach((row, idx) => {
    const result = transformer(row, config.mapping, config.orgId, config.defaultRole);
    if (result.skip) {
      report.skipped.push({ row: idx + 2, reason: result.reason }); // +2 = header + 1-index
      return;
    }
    // Flag ambiguous phone numbers for human review rather than
    // silently trusting the heuristic.
    if (config.entity === 'people' && row[config.mapping.whatsapp_number] && !result.person.whatsapp_number) {
      report.flagged.push({ row: idx + 2, field: 'whatsapp_number', raw: row[config.mapping.whatsapp_number] });
    }
    toWrite.push(result);
    report.imported++;
  });

  console.log(`\nParsed ${report.total} rows from ${config.csvPath}`);
  console.log(`  Would import: ${report.imported}`);
  console.log(`  Skipped: ${report.skipped.length}`);
  if (report.skipped.length) {
    report.skipped.forEach((s) => console.log(`    - row ${s.row}: ${s.reason}`));
  }
  if (report.flagged.length) {
    console.log(`  Flagged for review (ambiguous data, imported anyway): ${report.flagged.length}`);
    report.flagged.forEach((f) => console.log(`    - row ${f.row}: ${f.field} = "${f.raw}"`));
  }

  if (args.dryRun) {
    console.log('\n[dry run] No data written. Sample of first 3 records:');
    console.log(JSON.stringify(toWrite.slice(0, 3), null, 2));
    return;
  }

  if (!createClient) {
    console.error('\n@supabase/supabase-js not installed — cannot write. Run with --dry-run, or `npm install @supabase/supabase-js`.');
    process.exit(1);
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('\nMissing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let written = 0;
  for (const record of toWrite) {
    if (config.entity === 'people') {
      const { data: person, error: personErr } = await supabase
        .from('people')
        .upsert(record.person, { onConflict: 'email' })
        .select()
        .single();
      if (personErr) { console.error('person upsert failed:', personErr.message); continue; }

      const { error: memberErr } = await supabase
        .from('memberships')
        .upsert({ ...record.membership, person_id: person.id }, { onConflict: 'org_id,person_id,role' });
      if (memberErr) { console.error('membership upsert failed:', memberErr.message); continue; }
    } else if (config.entity === 'donors') {
      const { error } = await supabase.from('donors').insert(record.donor);
      if (error) { console.error('donor insert failed:', error.message); continue; }
    } else if (config.entity === 'inventory_items') {
      const { error } = await supabase.from('inventory_items').insert(record.item);
      if (error) { console.error('inventory insert failed:', error.message); continue; }
    }
    written++;
  }
  console.log(`\nWrote ${written}/${toWrite.length} records to Supabase.`);
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
