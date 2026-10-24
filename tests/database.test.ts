// Loads db/schema.sql + db/seed.sql into a real PostgreSQL engine (PGlite, in-process)
// and checks the SQL store returns exactly what the in-memory seed store returns.
// Run with: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createSqlStore } from "../server/sqlStore";
import { createSeedStore } from "../src/catalogue/store";
import { comparisonWithStore, searchWithStore, verifyWithStore } from "../src/catalogue/service";
import { extractionFromRecord } from "../src/domain/verification";
import { MEDICINES as ALL, isRealRecord } from "../src/data/seed";
const MEDICINES = ALL.filter((m) => isRealRecord(m.medicine_id));
import { calculateSavings } from "../src/domain/pricing";
import { SCENARIOS } from "../src/mock/scenarios";

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + name); };
const norm = (x: any) => JSON.parse(JSON.stringify(x, (_k, v) => (Array.isArray(v) && v.length && v[0]?.medicine_id ? [...v].sort((a, b) => a.medicine_id.localeCompare(b.medicine_id)) : Array.isArray(v) && v.length && v[0]?.reason ? [...v].sort((a, b) => a.reason.localeCompare(b.reason)) : v)));

(async () => {
  console.log("PostgreSQL catalogue (schema.sql + seed.sql in PGlite)");
  const pg = new PGlite();
  await pg.exec("SET TIME ZONE 'UTC';");
  await pg.exec(readFileSync("db/schema.sql", "utf8"));
  await pg.exec(readFileSync("db/schema.sql", "utf8")); // idempotent
  await pg.exec(readFileSync("db/seed.sql", "utf8"));
  const sql = createSqlStore({ query: async (text, params) => (await pg.query(text, params as any[])).rows as any[] });
  const seed = createSeedStore(undefined, "real");

  await test("seed loads with every row and constraint satisfied", async () => {
    const info = await sql.describe();
    const local = await seed.describe();
    assert.equal(info.medicines, local.medicines);
    assert.equal(info.prices, local.prices);
    assert.ok(info.medicines >= 40, `expected 40+ real medicines, got ${info.medicines}`);
  });

  await test("constraints reject bad rows", async () => {
    await assert.rejects(pg.query(`INSERT INTO price_records (price_id, medicine_id, price_type, amount, pack_quantity, price_source, verification_status) VALUES ('x', 'real_dolo_650', 'MRP', 10, 10, 's', 'verified')`));
    await assert.rejects(pg.query(`INSERT INTO medicines (medicine_id, brand_name, brand_family, active_ingredients, ingredients_norm, strength, dosage_form, release_type, verification_status, review_status) VALUES ('y','Y','y',ARRAY['A'],ARRAY['a'],'1 mg','Syrup','IR','verified','approved')`));
  });

  await test("verification gives identical results from SQL and seed (all scenarios + every product)", async () => {
    const cases = [...MEDICINES.map(extractionFromRecord),
      { ...SCENARIOS.matched, brand_name: { value: "Cetimac", read: "clear" as const }, active_ingredients: { value: "Cetirizine", read: "clear" as const }, strength: { value: "10 mg", read: "clear" as const }, release_type: { value: null, read: "not_found" as const } }];
    for (const ex of cases) assert.deepEqual(norm(await verifyWithStore(sql, ex)), norm(await verifyWithStore(seed, ex)), JSON.stringify(ex.brand_name));
  });

  await test("search gives identical results (brands, salts, misspellings, pack text)", async () => {
    for (const q of ["glucora", "cetrizine", "Cetirizine Tablets I.P. 10mg", "amoxycillin", "pantoprazole sodium", "atorva", "Paracetamol 650", "xyz", "thyroxine", "crocin", "donolex", "Saridon", "okacet 10mg", "dolo", "telma", "jan aushadhi"]) {
      assert.deepEqual((await searchWithStore(sql, q)).map((m) => m.medicine_id), (await searchWithStore(seed, q)).map((m) => m.medicine_id), q);
    }
    assert.ok((await searchWithStore(sql, "amoxycillin")).length > 0);
  });

  await test("comparison gives identical alternatives and prices for every product", async () => {
    for (const m of MEDICINES) assert.deepEqual(norm(await comparisonWithStore(sql, m.medicine_id)), norm(await comparisonWithStore(seed, m.medicine_id)), m.medicine_id);
  });

  await test("real estimate: Dolo 650 → Jan Aushadhi Paracetamol 650, 3 a day", async () => {
    const c = await comparisonWithStore(sql, "real_dolo_650");
    const alt = c.alternatives.find((a) => a.medicine_id === "ja_511")!;
    const s = calculateSavings(c.current, alt, "MRP", 3);
    // Dolo ₹32.12/15 = ₹2.1413; JA ₹15.47/15 = ₹1.0313 → (2.1413 − 1.0313) × 3 × 30 = ₹99.90/month
    assert.ok(s.ok && s.monthlySaving === 99.9, JSON.stringify(s));
  });

  await test("levothyroxine: no alternative offered (narrow therapeutic index)", async () => {
    assert.equal((await comparisonWithStore(sql, "real_thyronorm_50")).alternatives.length, 0);
  });

  await test("every real brand except levothyroxine, metoprolol-free list, piroxicam and Saridons has a Jan Aushadhi alternative", async () => {
    const none = [];
    for (const m of MEDICINES.filter((x) => x.medicine_id.startsWith("real_"))) {
      if ((await comparisonWithStore(sql, m.medicine_id)).alternatives.length === 0) none.push(m.medicine_id);
    }
    assert.deepEqual(none.sort(), ["real_dolonex_rapid_20", "real_new_saridon", "real_saridon", "real_thyronorm_50"]);
  });

  console.log(`\n${passed} database tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
