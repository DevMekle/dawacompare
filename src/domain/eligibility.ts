// Eligibility rules for alternatives. Only records that match the confirmed
// product on every formulation attribute, come from a verified catalogue record
// and carry an approved review status are ever returned. Everything else is
// counted by reason so the UI can explain what was left out, without listing it.

import { ExclusionReason, MedicineRecord } from "./types";
import { normalizeStrength, sameIngredients, sharesIngredient } from "./normalize";

export interface EligibilityResult {
  eligible: MedicineRecord[];
  excluded: { reason: ExclusionReason; count: number }[];
}

export function exclusionReason(current: MedicineRecord, r: MedicineRecord): ExclusionReason | null {
  if (!sameIngredients(current.active_ingredients, r.active_ingredients)) return "different_ingredients";
  if (normalizeStrength(current.strength) !== normalizeStrength(r.strength)) return "different_strength";
  if (current.dosage_form !== r.dosage_form) return "different_form";
  if (current.release_type !== r.release_type) return "different_release";
  if (r.verification_status !== "verified") return "unverified_record";
  if (r.review_status !== "approved") return "not_reviewed";
  return null;
}

export function findEligibleAlternatives(current: MedicineRecord, catalogue: MedicineRecord[]): EligibilityResult {
  const eligible: MedicineRecord[] = [];
  const counts = new Map<ExclusionReason, number>();
  for (const r of catalogue) {
    if (r.medicine_id === current.medicine_id) continue;
    if (!sharesIngredient(current.active_ingredients, r.active_ingredients)) continue;
    const why = exclusionReason(current, r);
    if (why) counts.set(why, (counts.get(why) ?? 0) + 1);
    else eligible.push(r);
  }
  return { eligible, excluded: Array.from(counts, ([reason, count]) => ({ reason, count })) };
}
