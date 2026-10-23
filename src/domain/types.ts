// Shared types. Field names follow the planned backend schema (snake_case)
// so the mock layer can later be swapped for real API responses unchanged.

export type DosageForm = "Tablet" | "Capsule";
export type ReleaseType = "IR" | "SR" | "ER" | "MR" | "DR";
export type ReviewStatus = "approved" | "pending" | "rejected";
export type RecordVerification = "verified" | "unverified";
export type PriceType = "MRP" | "SELLING_PRICE";
export type PriceSourceKey = "sample_manufacturer_list" | "sample_pharmacy_feed" | "sample_pack_mrp" | "sample_admin_entry";

/** One product in the structured medicine catalogue (planned: PostgreSQL `medicines` table). */
export interface MedicineRecord {
  medicine_id: string;
  brand_name: string;
  manufacturer: string | null;
  active_ingredients: string[];
  strength: string;
  dosage_form: DosageForm;
  release_type: ReleaseType;
  /** Catalogue record checked by the data team (demo value). */
  verification_status: RecordVerification;
  /** Review of this product as an alternative within its formulation group (demo value). */
  review_status: ReviewStatus;
}

/** One stored price (planned: `price_records` table, filled by the admin workflow). */
export interface PriceRecord {
  price_id: string;
  medicine_id: string;
  price_type: PriceType;
  amount: number;
  pack_quantity: number;
  price_source: PriceSourceKey;
  verification_status: RecordVerification;
  /** ISO date, or null if never verified. */
  last_verified_at: string | null;
}

export type PriceFreshness = "current" | "stale" | "unverified";

/** A price record as returned to the UI, with freshness worked out by the backend. */
export interface PriceQuote extends Omit<PriceRecord, "price_id" | "medicine_id"> {
  freshness: PriceFreshness;
  /** amount ÷ pack_quantity, only when the quote is current and verified. */
  per_unit: number | null;
}

/** API shape for one product on the comparison screen. */
export interface ComparableProduct extends MedicineRecord {
  mrp: PriceQuote | null;
  actual_selling_price: PriceQuote | null;
  pack_quantity: number | null;
  price_source: PriceSourceKey | null;
  last_verified_at: string | null;
}

// ---- identification ---------------------------------------------------------

export type FieldKey = "brand_name" | "active_ingredients" | "strength" | "dosage_form" | "release_type";
export const CRITICAL_FIELDS: FieldKey[] = ["brand_name", "active_ingredients", "strength", "dosage_form", "release_type"];

/** clear/unclear/not_found come from the (simulated) vision step; user = typed or corrected by the user. */
export type ReadQuality = "clear" | "unclear" | "not_found" | "user";

export interface ExtractedField {
  value: string | null;
  read: ReadQuality;
}

export type Extraction = Record<FieldKey, ExtractedField>;

export type CheckResult = "match" | "unclear" | "missing" | "mismatch" | "no_record";

export interface FieldCheck {
  field: FieldKey;
  extracted: string | null;
  catalogue: string | null;
  read: ReadQuality;
  result: CheckResult;
}

export type VerificationStatus = "matched" | "needs_confirmation" | "unable";
export type UnableReason = "unreadable" | "no_record" | "critical_mismatch";

export interface VerificationResult {
  status: VerificationStatus;
  reason: UnableReason | null;
  /** The single catalogue record that passed every check (matched). */
  record: MedicineRecord | null;
  /** Records still consistent with what was read (needs_confirmation): the user must pick one. */
  candidates: MedicineRecord[];
  /** Field-by-field checks against the matched record, the only candidate, or the closest record. */
  checks: FieldCheck[];
}

// ---- comparison -------------------------------------------------------------

export type ExclusionReason = "not_reviewed" | "different_release" | "different_strength" | "different_ingredients" | "different_form" | "unverified_record";

export interface ComparisonResponse {
  current: ComparableProduct;
  alternatives: ComparableProduct[];
  excluded: { reason: ExclusionReason; count: number }[];
}
