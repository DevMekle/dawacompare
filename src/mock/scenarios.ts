// Simulated outputs of the planned OpenAI Vision extraction step.
// The prototype never sends a photo anywhere: it returns one of these
// predefined readings. FICTIONAL DEMONSTRATION DATA.

import { Extraction, ExtractedField } from "../domain/types";

export type ScenarioId = "matched" | "ambiguous_release" | "strength_mismatch" | "unreadable" | "price_missing";

const c = (value: string): ExtractedField => ({ value, read: "clear" });
const u = (value: string): ExtractedField => ({ value, read: "unclear" });
const none: ExtractedField = { value: null, read: "not_found" };

export const SCENARIOS: Record<ScenarioId, Extraction> = {
  /** Every critical field read clearly and matches exactly one catalogue record. */
  matched: {
    brand_name: c("Glucora SR 500"),
    active_ingredients: c("Metformin Hydrochloride"),
    strength: c("500 mg"),
    dosage_form: c("Tablet"),
    release_type: c("SR"),
  },
  /** Torn label: the release marking is missing, so two catalogue entries fit. */
  ambiguous_release: {
    brand_name: u("Glucora 500"),
    active_ingredients: c("Metformin Hydrochloride"),
    strength: c("500 mg"),
    dosage_form: c("Tablet"),
    release_type: none,
  },
  /** Strength read as 80 mg, but the only catalogue record for this brand is 40 mg. */
  strength_mismatch: {
    brand_name: c("Telvia 40"),
    active_ingredients: c("Telmisartan"),
    strength: u("80 mg"),
    dosage_form: c("Tablet"),
    release_type: c("IR"),
  },
  /** Blurred photo: nothing usable was read. */
  unreadable: {
    brand_name: none,
    active_ingredients: none,
    strength: none,
    dosage_form: none,
    release_type: none,
  },
  /** Matches cleanly, but the stored price for this product is not verified. */
  price_missing: {
    brand_name: c("Amlocard 5"),
    active_ingredients: c("Amlodipine Besylate"),
    strength: c("5 mg"),
    dosage_form: c("Tablet"),
    release_type: c("IR"),
  },
};
