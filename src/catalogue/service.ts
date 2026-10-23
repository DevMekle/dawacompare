// Catalogue use-cases shared by the browser fallback and the Vercel API.
// Each one loads only the rows it needs from a CatalogueStore, then applies the
// same pure rules (verification, eligibility, price freshness) everywhere.

import { ComparisonResponse, Extraction, MedicineRecord, VerificationResult } from "../domain/types";
import { verifyExtraction } from "../domain/verification";
import { findEligibleAlternatives } from "../domain/eligibility";
import { withPrices } from "../domain/pricing";
import { brandFamily, canonicalSalt, normalizeIngredients } from "../domain/normalize";
import { CatalogueStore } from "./store";

export async function verifyWithStore(store: CatalogueStore, ex: Extraction): Promise<VerificationResult> {
  const has = (v: { value: string | null; read: string }) => !!v.value && v.read !== "not_found";
  const family = has(ex.brand_name) ? brandFamily(ex.brand_name.value!) : null;
  const salts = has(ex.active_ingredients) ? normalizeIngredients(ex.active_ingredients.value!) : [];
  const pool = await store.candidates(family || null, salts);
  return verifyExtraction(ex, pool);
}

/** Turns what a user types ("Cetrizine Tablets I.P. 10mg") into lower-case brand/salt search terms. */
export function searchTerms(query: string): string[] {
  const q = query.trim().toLowerCase().replace(/[%_\\]/g, " ");
  if (q.length < 2) return [];
  const words = q
    .replace(/\b(tablets?|tabs?|capsules?|i\.?p\.?|b\.?p\.?|u\.?s\.?p\.?|mg|mcg|\d+(\.\d+)?\s*(mg|mcg)?)\b/g, " ")
    .split(/[\s,+/]+/)
    .filter((w) => w.length >= 3);
  return Array.from(new Set([q, ...words].map(canonicalSalt)));
}

export async function searchWithStore(store: CatalogueStore, query: string): Promise<MedicineRecord[]> {
  const terms = searchTerms(query);
  return terms.length ? store.search(terms, 8) : [];
}

export async function comparisonWithStore(store: CatalogueStore, medicineId: string, now: Date = new Date()): Promise<ComparisonResponse> {
  const current = await store.byId(medicineId);
  if (!current) throw new Error("not_found");
  const related = await store.sharingIngredients(normalizeIngredients(current.active_ingredients));
  const { eligible, excluded } = findEligibleAlternatives(current, related);
  const prices = await store.prices([current.medicine_id, ...eligible.map((m) => m.medicine_id)]);
  return {
    current: withPrices(current, prices, now),
    alternatives: eligible.map((r) => withPrices(r, prices, now)),
    excluded,
  };
}
