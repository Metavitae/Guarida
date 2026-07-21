/**
 * Guarida — Case Intake
 * ------------------------------------------------------------------
 * Handles the actual moment someone reports a case: description, photo/
 * video, location, witness info — plus two pieces of automation that
 * are deliberately NOT fully automatic:
 *
 *  1. Legal-match suggestion — scores the description against whatever
 *     legal_references exist for the case's jurisdiction, and stores the
 *     suggestion UNCONFIRMED. Nothing acts on it until a human calls
 *     confirmLegalMatch().
 *
 *  2. Vet flagging — if the case needs veterinary attention, this looks
 *     up the org's own active vet members and creates a notification
 *     row for each. It does NOT send the WhatsApp message itself — that's
 *     the bridge module's job (sendWhatsAppMessage from bridge.js). This
 *     file only decides WHO needs to know; delivery is a separate concern.
 * ------------------------------------------------------------------
 */

// ---------------------------------------------------------------------
// 1. Create a case + attach any media/witness records
// ---------------------------------------------------------------------
async function createCase(supabase, {
  orgId, title, description, species, location, jurisdiction,
  animalId, createdBy, media = [], requiresVet = false,
}) {
  const { data: caseRow, error: caseErr } = await supabase
    .from('cases')
    .insert({
      org_id: orgId,
      title,
      description,
      species,
      location,
      jurisdiction: jurisdiction || 'MX',
      animal_id: animalId || null,
      created_by: createdBy,
      status: 'open',
    })
    .select()
    .single();

  if (caseErr) throw caseErr;

  if (media.length) {
    const mediaRows = media.map((m) => ({
      case_id: caseRow.id,
      media_type: m.type,
      url: m.url,
      witness_name: m.witnessName || null,
      witness_contact: m.witnessContact || null,
    }));
    const { error: mediaErr } = await supabase.from('case_media').insert(mediaRows);
    if (mediaErr) throw mediaErr;
  }

  const suggestions = await suggestLegalMatches(supabase, description, jurisdiction || 'MX');
  if (suggestions.length) {
    const matchRows = suggestions.map((s) => ({
      case_id: caseRow.id,
      legal_reference_id: s.id,
      suggested_by: 'ai',
      // confirmed_by / confirmed_at stay null — a human must act on these
    }));
    const { error: matchErr } = await supabase.from('case_legal_matches').insert(matchRows);
    if (matchErr) throw matchErr;
  }

  if (requiresVet) {
    await flagForVetAttention(supabase, orgId, caseRow.id);
  }

  return { case: caseRow, suggestedLegalMatches: suggestions };
}

// ---------------------------------------------------------------------
// 2. Legal-match suggestion — simple keyword overlap for now.
//    This is intentionally not fancy: it's a starting point for a human
//    to review, not a legal-reasoning engine. Upgrading the scoring
//    later doesn't change the contract (still suggests, never confirms).
// ---------------------------------------------------------------------
async function suggestLegalMatches(supabase, description, jurisdiction) {
  const { data: references, error } = await supabase
    .from('legal_references')
    .select('id, title, summary, statute_code, jurisdiction, lawyer_reviewed')
    .eq('jurisdiction', jurisdiction);

  if (error) throw error;
  if (!references || !references.length) return [];

  const words = new Set(
    description.toLowerCase().replace(/[^\w\sáéíóúñ]/gi, '').split(/\s+/).filter(Boolean)
  );

  const scored = references.map((ref) => {
    const refWords = `${ref.title} ${ref.summary}`.toLowerCase().split(/\s+/);
    const overlap = refWords.filter((w) => words.has(w)).length;
    return { ...ref, score: overlap };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // top 3 candidates — a human picks from these, or none
}

// ---------------------------------------------------------------------
// 3. A human confirms (or rejects) a suggested legal match.
// ---------------------------------------------------------------------
async function confirmLegalMatch(supabase, caseLegalMatchId, confirmedByPersonId) {
  const { error } = await supabase
    .from('case_legal_matches')
    .update({ confirmed_by: confirmedByPersonId, confirmed_at: new Date().toISOString() })
    .eq('id', caseLegalMatchId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// 4. Vet flagging — finds active vets in the org, records who needs to
//    know. Actual message delivery happens elsewhere (bridge.js).
// ---------------------------------------------------------------------
async function flagForVetAttention(supabase, orgId, caseId) {
  const { data: vets, error } = await supabase
    .from('memberships')
    .select('person_id, people(full_name, whatsapp_number)')
    .eq('org_id', orgId)
    .eq('role', 'vet')
    .eq('status', 'active');

  if (error) throw error;
  if (!vets || !vets.length) {
    return { notified: [], warning: 'No active vet members found for this org.' };
  }

  const rows = vets.map((v) => ({
    case_id: caseId,
    vet_person_id: v.person_id,
    notified_at: new Date().toISOString(),
  }));
  const { error: insertErr } = await supabase.from('vet_notifications').insert(rows);
  if (insertErr) throw insertErr;

  return { notified: vets.map((v) => v.people?.full_name).filter(Boolean) };
}

module.exports = { createCase, suggestLegalMatches, confirmLegalMatch, flagForVetAttention };
