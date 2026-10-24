// Writes db/seed.sql from src/data/seed.ts. Run: npm run db:sql
import { writeFileSync } from "node:fs";
import { MEDICINES as ALL_MEDICINES, PRICE_SEED as ALL_PRICES, isRealRecord } from "../src/data/seed";

// The live database holds real-world rows only. Sample rows stay in the app for the demo mode.
const MEDICINES = ALL_MEDICINES.filter((m) => isRealRecord(m.medicine_id));
const PRICE_SEED = ALL_PRICES.filter((p) => isRealRecord(p.medicine_id));
import { brandFamily, normalizeIngredients } from "../src/domain/normalize";

const q = (s: string | null) => (s == null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const arr = (xs: string[]) => `ARRAY[${xs.map(q).join(", ")}]::text[]`;

const meds = MEDICINES.map((m) =>
  `  (${[q(m.medicine_id), q(m.brand_name), q(brandFamily(m.brand_name)), q(m.manufacturer), arr(m.active_ingredients), arr(normalizeIngredients(m.active_ingredients)), q(m.strength), q(m.dosage_form), q(m.release_type), q(m.verification_status), q(m.review_status)].join(", ")})`,
);
const prices = PRICE_SEED.map((p) =>
  `  (${[q(p.price_id), q(p.medicine_id), q(p.price_type), p.amount.toFixed(2), String(p.pack_quantity), q(p.price_source), q(p.verification_status), p.verified_on ? `DATE ${q(p.verified_on)}` : p.verified_days_ago == null ? "NULL" : `CURRENT_DATE - ${p.verified_days_ago}`].join(", ")})`,
);

const sql = `-- DawaCompare catalogue. Generated from src/data/seed.ts by \`npm run db:sql\`; do not edit by hand.
-- Real-world data only:
--   real_*  brands with MRP from public online pharmacy listings (dated)
--   ja_*    Jan Aushadhi generics from the PMBJP product list (drug code, unit size, MRP; dated)
-- "approved" on a Jan Aushadhi row means same salt, strength, form and release type as listed; not a clinical review.
-- Re-running replaces all catalogue rows.

BEGIN;

DELETE FROM price_records;
DELETE FROM medicines;

INSERT INTO medicines (medicine_id, brand_name, brand_family, manufacturer, active_ingredients, ingredients_norm, strength, dosage_form, release_type, verification_status, review_status) VALUES
${meds.join(",\n")};

INSERT INTO price_records (price_id, medicine_id, price_type, amount, pack_quantity, price_source, verification_status, last_verified_at) VALUES
${prices.join(",\n")};

COMMIT;
`;
writeFileSync(new URL("../db/seed.sql", import.meta.url), sql);
console.log(`db/seed.sql: ${MEDICINES.length} medicines, ${PRICE_SEED.length} price records`);
