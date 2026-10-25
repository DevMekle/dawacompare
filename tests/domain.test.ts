// Run with: npm test
import assert from "node:assert/strict";
import { verifyExtraction, extractionFromRecord } from "../src/domain/verification";
import { findEligibleAlternatives } from "../src/domain/eligibility";
import { withPrices, calculateSavings, comparableBases } from "../src/domain/pricing";
import { MEDICINES as ALL_MEDICINES, buildPriceRecords } from "../src/mock/catalogue";
import { isRealRecord } from "../src/data/seed";
// Most tests exercise the sample/demo catalogue; the real-data tests use ALL_MEDICINES.
const MEDICINES = ALL_MEDICINES.filter((m) => !isRealRecord(m.medicine_id));
import { SCENARIOS } from "../src/mock/scenarios";
import { Extraction } from "../src/domain/types";

const now = new Date("2026-10-23T12:00:00Z");
const prices = buildPriceRecords(now);
const byId = (id: string) => ALL_MEDICINES.find((m) => m.medicine_id === id)!;
const product = (id: string) => withPrices(byId(id), prices, now);
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + name); };

console.log("Verification layer");
test("fully matched medicine", () => {
  const v = verifyExtraction(SCENARIOS.matched, MEDICINES);
  assert.equal(v.status, "matched");
  assert.equal(v.record?.medicine_id, "med_glucora_sr500");
});
test("missing release type needs the user to choose between catalogue entries", () => {
  const v = verifyExtraction(SCENARIOS.ambiguous_release, MEDICINES);
  assert.equal(v.status, "needs_confirmation");
  assert.deepEqual(v.candidates.map((c) => c.medicine_id).sort(), ["med_glucora_500", "med_glucora_sr500"]);
  assert.equal(v.record, null);
});
test("strength mismatch blocks comparison", () => {
  const v = verifyExtraction(SCENARIOS.strength_mismatch, MEDICINES);
  assert.equal(v.status, "unable");
  assert.equal(v.reason, "critical_mismatch");
  assert.equal(v.checks.find((c) => c.field === "strength")?.result, "mismatch");
});
test("correcting the strength re-verifies and then matches", () => {
  const fixed: Extraction = { ...SCENARIOS.strength_mismatch, strength: { value: "40 mg", read: "user" } };
  const v = verifyExtraction(fixed, MEDICINES);
  assert.equal(v.status, "matched");
  assert.equal(v.record?.medicine_id, "med_telvia_40");
});
test("a different release type never matches", () => {
  const wrong: Extraction = { ...SCENARIOS.matched, release_type: { value: "ER", read: "user" } };
  assert.equal(verifyExtraction(wrong, MEDICINES).status, "unable");
});
test("unreadable photo is blocked", () => {
  const v = verifyExtraction(SCENARIOS.unreadable, MEDICINES);
  assert.equal(v.status, "unable");
  assert.equal(v.reason, "unreadable");
});
test("unknown brand is blocked", () => {
  const ex: Extraction = { ...SCENARIOS.matched, brand_name: { value: "Zentrova 10", read: "clear" }, active_ingredients: { value: "Rosuvastatin", read: "clear" } };
  assert.equal(verifyExtraction(ex, MEDICINES).reason, "no_record");
});
test("manual pick of a catalogue record verifies as matched", () => {
  assert.equal(verifyExtraction(extractionFromRecord(byId("med_amlocard_5")), MEDICINES).status, "matched");
});

test("a brand read from the pack but missing from the catalogue is no_record", () => {
  const ex: Extraction = { brand_name: { value: "Cetimac", read: "clear" }, active_ingredients: { value: "Cetirizine", read: "clear" }, strength: { value: "10 mg", read: "clear" }, dosage_form: { value: "Tablet", read: "clear" }, release_type: { value: null, read: "not_found" } };
  const v = verifyExtraction(ex, MEDICINES);
  assert.equal(v.status, "unable");
  assert.equal(v.reason, "no_record");
  assert.equal(v.checks[0].result, "no_record");
});

console.log("Eligibility");
test("only approved, exact-formulation alternatives are returned", () => {
  const r = findEligibleAlternatives(byId("med_glucora_sr500"), MEDICINES);
  assert.deepEqual(r.eligible.map((m) => m.medicine_id).sort(), ["med_duometa_sr500", "med_glyminor_sr500", "med_metaveda_sr500", "med_metsave_sr500"]);
  const reasons = Object.fromEntries(r.excluded.map((e) => [e.reason, e.count]));
  assert.deepEqual(reasons, { not_reviewed: 1, different_release: 1, different_strength: 1, different_ingredients: 1 });
});
test("no eligible alternative for Telvia 40", () => {
  assert.equal(findEligibleAlternatives(byId("med_telvia_40"), MEDICINES).eligible.length, 0);
});

test("cetirizine group: approved alternatives only, misspelling normalised", () => {
  const r = findEligibleAlternatives(byId("med_allerfree_10"), MEDICINES);
  assert.deepEqual(r.eligible.map((m) => m.medicine_id), ["med_cetzy_10"]);
  assert.equal(r.excluded.find((e) => e.reason === "not_reviewed")?.count, 1);
  const ex: Extraction = { brand_name: { value: null, read: "not_found" }, active_ingredients: { value: "Cetrizine", read: "clear" }, strength: { value: "10 mg", read: "clear" }, dosage_form: { value: "Tablet", read: "clear" }, release_type: { value: "IR", read: "clear" } };
  assert.equal(verifyExtraction(ex, MEDICINES).status, "needs_confirmation"); // brand unknown: user must pick the product
});

test("real data: other brands and Jan Aushadhi generics are both alternatives", () => {
  assert.equal(verifyExtraction(extractionFromRecord(byId("real_dolo_650")), ALL_MEDICINES).status, "matched");
  const REAL = ALL_MEDICINES.filter((m) => isRealRecord(m.medicine_id));
  const dolo = findEligibleAlternatives(byId("real_dolo_650"), REAL);
  assert.deepEqual(dolo.eligible.map((m) => m.medicine_id).sort(), ["ja_511", "real_calpol_650p", "real_crocin_adv_650", "real_pacimol_650", "real_paracip_650"]);
  // a different strength of the same brand family is never offered
  assert.ok(!findEligibleAlternatives(byId("real_crocin_adv_650"), REAL).eligible.some((m) => m.medicine_id === "real_crocin_adv_500"));
  // brands whose switch needs a doctor or whose tablet type is unconfirmed are never offered
  for (const id of ["real_thyronorm_50", "real_dolonex_rapid_20", "real_saridon"]) assert.ok(!REAL.some((m) => findEligibleAlternatives(m, REAL).eligible.some((e) => e.medicine_id === id)), id);
  // Deplatt 75 user sees the cheaper Clop 75 brand
  assert.ok(findEligibleAlternatives(byId("real_deplatt_75"), REAL).eligible.some((m) => m.medicine_id === "real_clop_75"));
  // Saridon (3 salts) and New Saridon (2 salts) are different formulations
  assert.ok(!findEligibleAlternatives(byId("real_new_saridon"), ALL_MEDICINES).eligible.some((m) => m.medicine_id === "real_saridon"));
  // levothyroxine: Jan Aushadhi row is not approved
  assert.ok(!findEligibleAlternatives(byId("real_thyronorm_50"), ALL_MEDICINES).eligible.some((m) => m.medicine_id === "ja_1221"));
});
test("expanded catalogue: common chronic medicines get branded and Jan Aushadhi options", () => {
  const REAL = ALL_MEDICINES.filter((m) => isRealRecord(m.medicine_id));
  const alts = (id: string) => findEligibleAlternatives(byId(id), REAL).eligible.map((m) => m.medicine_id).sort();
  assert.deepEqual(alts("real_januvia_100"), ["real_istavel_100"]);
  assert.deepEqual(alts("real_telma_h"), ["ja_298", "real_telmikind_h"]);
  assert.ok(alts("real_montair_lc").includes("ja_252") && alts("real_montair_lc").includes("real_montek_lc"));
  assert.ok(alts("real_shelcal_500").includes("real_cipcal_500"));
  // recognised but never offered: tablet type not stated on the listing
  assert.ok(!alts("real_glycomet_gp_2").includes("real_gemer_2"));
  assert.ok(!REAL.some((m) => alts(m.medicine_id).includes("real_razo_20")));
});
test("real prices carry their source and date", () => {
  assert.equal(product("real_okacet_10").mrp?.last_verified_at, "2026-10-24");
  assert.equal(product("real_okacet_10").mrp?.price_source, "public_listing");
  assert.equal(product("ja_240").mrp?.price_source, "jan_aushadhi_list");
});

console.log("Prices and savings");
test("price freshness flags", () => {
  assert.equal(product("med_metsave_sr500").mrp?.freshness, "current");
  assert.equal(product("med_metaveda_sr500").mrp?.freshness, "stale");
  assert.equal(product("med_duometa_sr500").mrp?.freshness, "unverified");
  assert.equal(product("med_glyminor_sr500").actual_selling_price, null);
});
test("savings: ₹4.00 vs ₹2.00 per tablet, 1 a day → ₹60/month, ₹720/year", () => {
  const s = calculateSavings(product("med_glucora_sr500"), product("med_metsave_sr500"), "MRP", 1);
  assert.ok(s.ok);
  if (s.ok) {
    assert.equal(s.current.monthly, 120);
    assert.equal(s.alternative.monthly, 60);
    assert.equal(s.monthlySaving, 60);
    assert.equal(s.annualSaving, 720);
  }
});
test("pack-size normalisation (₹45 for 15 vs ₹40 for 10), 2 a day", () => {
  const s = calculateSavings(product("med_glucora_sr500"), product("med_glyminor_sr500"), "MRP", 2);
  assert.ok(s.ok);
  if (s.ok) {
    assert.equal(s.alternative.per_unit, 3);
    assert.equal(s.monthlySaving, 60); // (4 − 3) × 2 × 30
    assert.equal(s.annualSaving, 720);
  }
});
test("selling-price basis only when both have verified selling prices", () => {
  assert.deepEqual(comparableBases(product("med_glucora_sr500"), product("med_metsave_sr500")), ["MRP", "SELLING_PRICE"]);
  assert.deepEqual(comparableBases(product("med_glucora_sr500"), product("med_glyminor_sr500")), ["MRP"]);
  const s = calculateSavings(product("med_glucora_sr500"), product("med_metsave_sr500"), "SELLING_PRICE", 1);
  assert.ok(s.ok && s.monthlySaving === 54 && s.annualSaving === 648);
});
test("stale or unverified prices produce no savings and name the problem", () => {
  const stale = calculateSavings(product("med_glucora_sr500"), product("med_metaveda_sr500"), "MRP", 1);
  assert.ok(!stale.ok && stale.problems[0].issue === "stale" && stale.problems[0].who === "alternative");
  const unv = calculateSavings(product("med_amlocard_5"), product("med_amlonest_5"), "MRP", 1);
  assert.ok(!unv.ok && unv.problems[0].issue === "unverified" && unv.problems[0].who === "current");
});

console.log(`\n${passed} tests passed`);
