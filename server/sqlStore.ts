// PostgreSQL implementation of CatalogueStore. Works with any driver that can run
// a parameterised query and return rows (Neon serverless in production, PGlite in tests).

import { MedicineRecord, PriceRecord } from "../src/domain/types";
import { CatalogueStore } from "../src/catalogue/store";

export interface Db {
  query(text: string, params?: unknown[]): Promise<any[]>;
}

const COLS = "medicine_id, brand_name, manufacturer, active_ingredients, strength, dosage_form, release_type, verification_status, review_status";

const toMedicine = (r: any): MedicineRecord => ({
  medicine_id: r.medicine_id,
  brand_name: r.brand_name,
  manufacturer: r.manufacturer ?? null,
  active_ingredients: Array.isArray(r.active_ingredients) ? r.active_ingredients : [],
  strength: r.strength,
  dosage_form: r.dosage_form,
  release_type: r.release_type,
  verification_status: r.verification_status,
  review_status: r.review_status,
});

const toPrice = (r: any): PriceRecord => ({
  price_id: r.price_id,
  medicine_id: r.medicine_id,
  price_type: r.price_type,
  amount: Number(r.amount),
  pack_quantity: Number(r.pack_quantity),
  price_source: r.price_source,
  verification_status: r.verification_status,
  last_verified_at: r.last_verified_at ?? null,
});

export function createSqlStore(db: Db): CatalogueStore {
  return {
    async candidates(family, salts) {
      const rows = await db.query(
        `SELECT ${COLS} FROM medicines WHERE ($1::text IS NOT NULL AND brand_family = $1::text) OR ingredients_norm && $2::text[]`,
        [family, salts],
      );
      return rows.map(toMedicine);
    },
    async search(terms, limit) {
      const patterns = terms.map((t) => `%${t}%`);
      const rows = await db.query(
        `SELECT ${COLS} FROM medicines
          WHERE verification_status = 'verified'
            AND (lower(brand_name) LIKE ANY($1::text[])
                 OR EXISTS (SELECT 1 FROM unnest(ingredients_norm) AS s WHERE s LIKE ANY($1::text[])))
          ORDER BY brand_name COLLATE "C"
          LIMIT $2`,
        [patterns, limit],
      );
      return rows.map(toMedicine);
    },
    async byId(id) {
      const rows = await db.query(`SELECT ${COLS} FROM medicines WHERE medicine_id = $1`, [id]);
      return rows[0] ? toMedicine(rows[0]) : null;
    },
    async sharingIngredients(salts) {
      const rows = await db.query(`SELECT ${COLS} FROM medicines WHERE ingredients_norm && $1::text[]`, [salts]);
      return rows.map(toMedicine);
    },
    async prices(ids) {
      if (!ids.length) return [];
      const rows = await db.query(
        `SELECT price_id, medicine_id, price_type, amount::float8 AS amount, pack_quantity, price_source, verification_status,
                to_char(last_verified_at, 'YYYY-MM-DD') AS last_verified_at
           FROM price_records WHERE medicine_id = ANY($1::text[])`,
        [ids],
      );
      return rows.map(toPrice);
    },
    async describe() {
      const [m] = await db.query(`SELECT count(*)::int AS n FROM medicines`);
      const [p] = await db.query(`SELECT count(*)::int AS n FROM price_records`);
      return { source: "postgres", medicines: m?.n ?? 0, prices: p?.n ?? 0 };
    },
  };
}
