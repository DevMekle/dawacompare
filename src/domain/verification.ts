// Verification Layer: checks a (simulated) vision extraction against the
// structured catalogue. In production this runs on the backend; it is kept
// pure here so the same rules can be unit-tested and reused.
//
// Rules
// - A critical field that contradicts the catalogue is a hard failure for that record.
// - A record is only "matched" when it is the single remaining record and every
//   critical field was read and agrees with it.
// - Missing or unclear fields leave the result at "needs_confirmation": the user
//   has to inspect the pack and pick the right catalogue entry.
// - If no record survives, the result is "unable" and comparison stays blocked.
//   User confirmation can never turn "unable" into "matched"; only a corrected
//   reading that passes these checks again can.

import { CRITICAL_FIELDS, Extraction, FieldCheck, FieldKey, MedicineRecord, VerificationResult } from "./types";
import { brandFamily, normalizeForm, normalizeIngredients, normalizeRelease, normalizeStrength, sameIngredients } from "./normalize";

export function catalogueValue(r: MedicineRecord, f: FieldKey): string {
  switch (f) {
    case "brand_name": return r.brand_name;
    case "active_ingredients": return r.active_ingredients.join(" + ");
    case "strength": return r.strength;
    case "dosage_form": return r.dosage_form;
    case "release_type": return r.release_type;
  }
}

function agrees(f: FieldKey, extracted: string, r: MedicineRecord): boolean {
  switch (f) {
    case "brand_name": return brandFamily(extracted) === brandFamily(r.brand_name);
    case "active_ingredients": return sameIngredients(extracted, r.active_ingredients);
    case "strength": return normalizeStrength(extracted) === normalizeStrength(r.strength);
    case "dosage_form": return normalizeForm(extracted) === r.dosage_form;
    case "release_type": return normalizeRelease(extracted) === r.release_type;
  }
}

export function checkAgainst(ex: Extraction, r: MedicineRecord): FieldCheck[] {
  return CRITICAL_FIELDS.map((field) => {
    const { value, read } = ex[field];
    const catalogue = catalogueValue(r, field);
    const present = value != null && value.trim() !== "" && read !== "not_found";
    const result = !present ? "missing" : !agrees(field, value!, r) ? "mismatch" : read === "unclear" ? "unclear" : "match";
    return { field, extracted: present ? value!.trim() : null, catalogue, read, result };
  });
}

/** Checks shown when several records remain: fields where they disagree show every option. */
function combinedChecks(ex: Extraction, records: MedicineRecord[]): FieldCheck[] {
  const per = records.map((r) => checkAgainst(ex, r));
  return CRITICAL_FIELDS.map((field, i) => {
    const values = Array.from(new Set(records.map((r) => catalogueValue(r, field))));
    if (values.length === 1) return per[0][i];
    const base = per[0][i];
    return { ...base, catalogue: values.join(" / "), result: base.result === "match" ? "unclear" : base.result };
  });
}

export function verifyExtraction(ex: Extraction, catalogue: MedicineRecord[]): VerificationResult {
  const has = (f: FieldKey) => !!ex[f].value && ex[f].read !== "not_found";

  if (!has("brand_name") && !has("active_ingredients")) {
    return { status: "unable", reason: "unreadable", record: null, candidates: [], checks: CRITICAL_FIELDS.map((field) => ({ field, extracted: null, catalogue: null, read: ex[field].read, result: "missing" })) };
  }

  // 1. Find records that could be this product.
  let pool = has("brand_name") ? catalogue.filter((r) => brandFamily(r.brand_name) === brandFamily(ex.brand_name.value!)) : [];
  if (pool.length === 0 && !has("brand_name") && has("active_ingredients")) {
    const salts = normalizeIngredients(ex.active_ingredients.value!);
    pool = catalogue.filter((r) => normalizeIngredients(r.active_ingredients).join("|") === salts.join("|"));
  }
  if (pool.length === 0) {
    return { status: "unable", reason: "no_record", record: null, candidates: [], checks: CRITICAL_FIELDS.map((field) => ({ field, extracted: has(field) ? ex[field].value : null, catalogue: null, read: ex[field].read, result: has(field) ? "no_record" : "missing" })) };
  }

  // 2. Check every critical field against each record.
  const scored = pool.map((r) => ({ r, checks: checkAgainst(ex, r) }));
  const viable = scored.filter((s) => s.r.verification_status === "verified" && s.checks.every((c) => c.result !== "mismatch"));

  // 3. Decide.
  if (viable.length === 0) {
    const closest = [...scored].sort((a, b) => a.checks.filter((c) => c.result === "mismatch").length - b.checks.filter((c) => c.result === "mismatch").length)[0];
    return { status: "unable", reason: "critical_mismatch", record: null, candidates: [], checks: closest.checks };
  }
  if (viable.length === 1 && viable[0].checks.every((c) => c.result === "match")) {
    return { status: "matched", reason: null, record: viable[0].r, candidates: [viable[0].r], checks: viable[0].checks };
  }
  return {
    status: "needs_confirmation",
    reason: null,
    record: null,
    candidates: viable.map((v) => v.r),
    checks: viable.length === 1 ? viable[0].checks : combinedChecks(ex, viable.map((v) => v.r)),
  };
}

/** Builds an extraction from a catalogue record the user picked by name (manual entry). */
export function extractionFromRecord(r: MedicineRecord): Extraction {
  const out = {} as Extraction;
  for (const f of CRITICAL_FIELDS) out[f] = { value: catalogueValue(r, f), read: "user" };
  return out;
}
