/**
 * Guarida — Donors, Foster Placements, Inventory, Expenses
 * ------------------------------------------------------------------
 * Four things that all touch the same underlying need from the brief:
 * "keep track of foster homes, volunteers, investors, contributors" and
 * "memory of every case and its expenses for reference to donors,
 * investors and management."
 *
 * Kept in one file because they're small and interrelated (an expense
 * can tie to a case, a donation can tie to a case, a foster placement
 * ties an animal to a person) — not because they're one "feature."
 * ------------------------------------------------------------------
 */

// ---------------------------------------------------------------------
// DONORS
// ---------------------------------------------------------------------
async function addDonor(supabase, { orgId, name, contact, donorType = 'prospect', notes }) {
  const { data, error } = await supabase
    .from('donors')
    .insert({ org_id: orgId, name, contact, donor_type: donorType, stage: 'prospect', notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateDonorStage(supabase, donorId, newStage) {
  const validStages = ['prospect', 'contacted', 'active', 'lapsed'];
  if (!validStages.includes(newStage)) {
    throw new Error(`Invalid stage "${newStage}". Must be one of: ${validStages.join(', ')}`);
  }
  const { error } = await supabase.from('donors').update({ stage: newStage }).eq('id', donorId);
  if (error) throw error;
}

async function recordDonation(supabase, { orgId, donorId, amount, currency = 'MXN', caseId }) {
  if (amount <= 0) throw new Error('Donation amount must be positive.');
  const { data, error } = await supabase
    .from('donations')
    .insert({ org_id: orgId, donor_id: donorId, amount, currency, case_id: caseId || null })
    .select()
    .single();
  if (error) throw error;

  // A donor who gives is no longer just a "prospect" — bump them forward
  // unless they're already further along (never move backward automatically).
  const { data: donor } = await supabase.from('donors').select('stage').eq('id', donorId).single();
  if (donor && donor.stage === 'prospect') {
    await updateDonorStage(supabase, donorId, 'active');
  }
  return data;
}

// ---------------------------------------------------------------------
// FOSTER PLACEMENTS
// ---------------------------------------------------------------------
async function assignFosterPlacement(supabase, { orgId, animalId, fosterPersonId }) {
  // An animal shouldn't be in two active foster placements at once —
  // check before inserting rather than relying on someone to notice later.
  const { data: existing, error: existingErr } = await supabase
    .from('foster_placements')
    .select('id')
    .eq('animal_id', animalId)
    .eq('status', 'active');
  if (existingErr) throw existingErr;
  if (existing && existing.length) {
    throw new Error(`Animal ${animalId} already has an active foster placement.`);
  }

  const { data, error } = await supabase
    .from('foster_placements')
    .insert({ org_id: orgId, animal_id: animalId, foster_person_id: fosterPersonId, status: 'active' })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('animals').update({ status: 'fostered' }).eq('id', animalId);
  return data;
}

async function endFosterPlacement(supabase, placementId, { newAnimalStatus = 'in_care' } = {}) {
  const { data: placement, error: fetchErr } = await supabase
    .from('foster_placements')
    .select('animal_id')
    .eq('id', placementId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error } = await supabase
    .from('foster_placements')
    .update({ status: 'completed', end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', placementId);
  if (error) throw error;

  await supabase.from('animals').update({ status: newAnimalStatus }).eq('id', placement.animal_id);
}

// ---------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------
async function adjustInventoryQuantity(supabase, itemId, delta) {
  const { data: item, error: fetchErr } = await supabase
    .from('inventory_items')
    .select('quantity, reorder_threshold, name')
    .eq('id', itemId)
    .single();
  if (fetchErr) throw fetchErr;

  const newQuantity = item.quantity + delta;
  if (newQuantity < 0) {
    throw new Error(`Adjustment would take "${item.name}" below zero (${item.quantity} + ${delta}).`);
  }

  const { error } = await supabase
    .from('inventory_items')
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;

  const belowThreshold = item.reorder_threshold != null && newQuantity <= item.reorder_threshold;
  return { newQuantity, belowThreshold, itemName: item.name };
}

// ---------------------------------------------------------------------
// EXPENSES + DONOR-FACING CASE REPORT
// ---------------------------------------------------------------------
async function addExpense(supabase, { orgId, caseId, animalId, amount, currency = 'MXN', category, description, receiptUrl }) {
  if (amount <= 0) throw new Error('Expense amount must be positive.');
  const { data, error } = await supabase
    .from('expenses')
    .insert({ org_id: orgId, case_id: caseId || null, animal_id: animalId || null, amount, currency, category, description, receipt_url: receiptUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// This is the "memory of every case and its expenses" from the brief —
// pulls everything spent on a case, plus anything donated specifically
// toward it, into one number a donor or board member can actually read.
async function getCaseFinancialSummary(supabase, caseId) {
  const { data: expenses, error: expErr } = await supabase.from('expenses').select('*').eq('case_id', caseId);
  if (expErr) throw expErr;
  const { data: donations, error: donErr } = await supabase.from('donations').select('*').eq('case_id', caseId);
  if (donErr) throw donErr;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalEarmarkedDonations = donations.reduce((sum, d) => sum + d.amount, 0);

  return {
    caseId,
    totalExpenses,
    totalEarmarkedDonations,
    netPosition: totalEarmarkedDonations - totalExpenses,
    expenseCount: expenses.length,
    expenses,
  };
}

module.exports = {
  addDonor, updateDonorStage, recordDonation,
  assignFosterPlacement, endFosterPlacement,
  adjustInventoryQuantity,
  addExpense, getCaseFinancialSummary,
};
