// Writes db/seed.sql from src/data/seed.ts. Run: npm run db:sql
import { writeFileSync } from "node:fs";
import { MEDICINES, PRICE_SEED } from "../src/data/seed";
import { brandFamily, normalizeIngredients } from "../src/domain/normalize";

const q = (s: string | null) => (s == null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const arr = (xs: string[]) => `ARRAY[${xs.map(q).join(", ")}]::text[]`;

const meds = MEDICINES.map((m) =>
  `  (${[q(m.medicine_id), q(m.brand_name), q(brandFamily(m.brand_name)), q(m.manufacturer), arr(m.active_ingredients), arr(normalizeIngredients(m.active_ingredients)), q(m.strength), q(m.dosage_form), q(m.release_type), q(m.verification_status), q(m.review_status)].join(", ")})`,
);
const prices = PRICE_SEED.map((p) =>
  `  (${[q(p.price_id), q(p.medicine_id), q(p.price_type), p.amount.toFixed(2), String(p.pack_quantity), q(p.price_source), q(p.verification_status), p.verified_on ? `DATE ${q(p.verified_on)}` : p.verified_days_ago == null ? "NULL" : `CURRENT_DATE - ${p.verified_days_ago}`].join(", ")})`,
);

const sql = `-- DawaCompare SAMPLE catalogue. Generated from src/data/seed.ts by \`npm run db:sql\`; do not edit by hand.
-- Salts, strengths, forms and release types are real common medicines.
-- Brand names, manufacturers, prices, sources and review statuses are FICTIONAL, except the rows with
-- medicine_id starting "real_": real brands for identification, MRP from public online listings (dated).
-- Dates are relative to the day you run this, so sample prices keep the same freshness.
-- Re-running replaces all sample rows.

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
