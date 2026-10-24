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
import { MEDICINES } from "../src/data/seed";
import { SCENARIOS } from "../src/mock/scenarios";
import { calculateSavings } from "../src/domain/pricing";

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
  const seed = createSeedStore();

  await test("seed loads with every row and constraint satisfied", async () => {
    const info = await sql.describe();
    const local = await seed.describe();
    assert.equal(info.medicines, local.medicines);
    assert.equal(info.prices, local.prices);
    assert.ok(info.medicines >= 100, `expected 100+ medicines, got ${info.medicines}`);
  });

  await test("constraints reject bad rows", async () => {
    await assert.rejects(pg.query(`INSERT INTO price_records (price_id, medicine_id, price_type, amount, pack_quantity, price_source, verification_status) VALUES ('x', 'med_pcm500_1', 'MRP', 10, 10, 's', 'verified')`));
    await assert.rejects(pg.query(`INSERT INTO medicines (medicine_id, brand_name, brand_family, active_ingredients, ingredients_norm, strength, dosage_form, release_type, verification_status, review_status) VALUES ('y','Y','y',ARRAY['A'],ARRAY['a'],'1 mg','Syrup','IR','verified','approved')`));
  });

  await test("verification gives identical results from SQL and seed (all scenarios + every product)", async () => {
    const cases = [...Object.values(SCENARIOS), ...MEDICINES.map(extractionFromRecord),
      { ...SCENARIOS.matched, brand_name: { value: "Cetimac", read: "clear" as const }, active_ingredients: { value: "Cetirizine", read: "clear" as const }, strength: { value: "10 mg", read: "clear" as const }, release_type: { value: null, read: "not_found" as const } }];
    for (const ex of cases) assert.deepEqual(norm(await verifyWithStore(sql, ex)), norm(await verifyWithStore(seed, ex)), JSON.stringify(ex.brand_name));
  });

  await test("search gives identical results (brands, salts, misspellings, pack text)", async () => {
    for (const q of ["glucora", "cetrizine", "Cetirizine Tablets I.P. 10mg", "amoxycillin", "pantoprazole sodium", "atorva", "Paracetamol 650", "xyz", "thyroxine", "crocin", "donolex", "Saridon", "okacet 10mg"]) {
      assert.deepEqual((await searchWithStore(sql, q)).map((m) => m.medicine_id), (await searchWithStore(seed, q)).map((m) => m.medicine_id), q);
    }
    assert.ok((await searchWithStore(sql, "amoxycillin")).length > 0);
  });

  await test("comparison gives identical alternatives and prices for every product", async () => {
    for (const m of MEDICINES) assert.deepEqual(norm(await comparisonWithStore(sql, m.medicine_id)), norm(await comparisonWithStore(seed, m.medicine_id)), m.medicine_id);
  });

  await test("database drives a full estimate: Glucora SR 500 → Metsave SR 500 = ₹60/month", async () => {
    const c = await comparisonWithStore(sql, "med_glucora_sr500");
    const alt = c.alternatives.find((a) => a.medicine_id === "med_metsave_sr500")!;
    const s = calculateSavings(c.current, alt, "MRP", 1);
    assert.ok(s.ok && s.monthlySaving === 60 && s.annualSaving === 720);
  });

  await test("levothyroxine: no approved alternatives (narrow therapeutic index)", async () => {
    const c = await comparisonWithStore(sql, "med_lt4_50_1");
    assert.equal(c.alternatives.length, 0);
  });

  console.log(`\n${passed} database tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
