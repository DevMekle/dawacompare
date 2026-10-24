// Data access for the medicine catalogue and price records.
// Two implementations share this interface:
//   - SeedStore (below): in-memory, from src/data/seed.ts. Used in the browser and when no database is configured.
//   - SqlStore (server/sqlStore.ts): PostgreSQL (Neon / Vercel Postgres / Supabase).
// Business rules live in src/catalogue/service.ts and src/domain/, never in a store.

import { MedicineRecord, PriceRecord } from "../domain/types";
import { MEDICINES, buildPriceRecords, isRealRecord } from "../data/seed";
import { brandFamily, normalizeIngredients } from "../domain/normalize";

export interface CatalogueInfo {
  source: "postgres" | "seed";
  medicines: number;
  prices: number;
}

export interface CatalogueStore {
  /** Records whose brand family equals `family`, or that share at least one canonical salt with `salts`. */
  candidates(family: string | null, salts: string[]): Promise<MedicineRecord[]>;
  /** Verified records whose brand or canonical salt contains any of the lower-case `terms`. Ordered by brand. */
  search(terms: string[], limit: number): Promise<MedicineRecord[]>;
  byId(id: string): Promise<MedicineRecord | null>;
  /** Records that share at least one canonical salt with `salts`. */
  sharingIngredients(salts: string[]): Promise<MedicineRecord[]>;
  /** All stored price records for these medicines. */
  prices(ids: string[]): Promise<PriceRecord[]>;
  describe(): Promise<CatalogueInfo>;
}

/** dataset "real": only real-world rows (what the live database holds). "all": also the sample/demo rows. */
export function createSeedStore(now: () => Date = () => new Date(), dataset: "real" | "all" = "all"): CatalogueStore {
  const meds = dataset === "real" ? MEDICINES.filter((m) => isRealRecord(m.medicine_id)) : MEDICINES;
  const allPrices = () => buildPriceRecords(now()).filter((p) => dataset === "all" || isRealRecord(p.medicine_id));
  const rows = meds.map((m) => ({ m, family: brandFamily(m.brand_name), salts: normalizeIngredients(m.active_ingredients) }));
  const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));
  const byBrand = (a: MedicineRecord, b: MedicineRecord) => (a.brand_name < b.brand_name ? -1 : a.brand_name > b.brand_name ? 1 : 0);
  return {
    async candidates(family, salts) {
      return rows.filter((r) => (family != null && r.family === family) || overlaps(r.salts, salts)).map((r) => r.m);
    },
    async search(terms, limit) {
      return rows
        .filter((r) => r.m.verification_status === "verified")
        .filter((r) => terms.some((t) => r.m.brand_name.toLowerCase().includes(t) || r.salts.some((s) => s.includes(t))))
        .map((r) => r.m)
        .sort(byBrand)
        .slice(0, limit);
    },
    async byId(id) {
      return meds.find((m) => m.medicine_id === id) ?? null;
    },
    async sharingIngredients(salts) {
      return rows.filter((r) => overlaps(r.salts, salts)).map((r) => r.m);
    },
    async prices(ids) {
      return allPrices().filter((p) => ids.includes(p.medicine_id));
    },
    async describe() {
      return { source: "seed", medicines: meds.length, prices: allPrices().length };
    },
  };
}
