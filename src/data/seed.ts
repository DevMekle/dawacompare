// ============================================================================
// DawaCompare seed catalogue: the single source of truth for sample data.
//
// - Salts, strengths, dosage forms and release types are real, commonly used
//   medicines in India.
// - Every BRAND NAME, MANUFACTURER, PRICE, SOURCE and REVIEW STATUS is FICTIONAL.
//   None of it describes a real product, a real market price or a real clinical
//   review. Real data should be loaded through the admin/import workflow.
//
// Used three ways:
//   1. `npm run db:sql` writes db/seed.sql for PostgreSQL from this file.
//   2. The Vercel API serves it when no DATABASE_URL is configured.
//   3. The browser bundles it so the app works offline / in previews.
// ============================================================================

import { DosageForm, MedicineRecord, PriceRecord, PriceSourceKey, PriceType, RecordVerification, ReleaseType, ReviewStatus } from "../domain/types";

export interface PriceSeed {
  price_id: string;
  medicine_id: string;
  price_type: PriceType;
  amount: number;
  pack_quantity: number;
  price_source: PriceSourceKey;
  verification_status: RecordVerification;
  /** Days before "today" the price was last verified; null if never. Keeps demo freshness stable. */
  verified_days_ago: number | null;
  /** Fixed verification date (YYYY-MM-DD) for real-world prices; overrides verified_days_ago. */
  verified_on?: string;
}

/** ISO date `days` before `now` (UTC). */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Hand-written groups used by the demo scenarios and tests. Do not change IDs.
// ---------------------------------------------------------------------------
const CORE_MEDICINES: MedicineRecord[] = [
  // --- Metformin 500 mg sustained-release tablet group ---
  { medicine_id: "med_glucora_sr500", brand_name: "Glucora SR 500", manufacturer: "Vindhya Demo Pharma", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_metsave_sr500", brand_name: "Metsave SR 500", manufacturer: "Arogya Demo Labs", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_glyminor_sr500", brand_name: "Glyminor SR 500", manufacturer: "Sahyadri Demo Pharma", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_duometa_sr500", brand_name: "Duometa SR 500", manufacturer: "Godavari Demo Pharma", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_metaveda_sr500", brand_name: "Metaveda SR 500", manufacturer: "Kaveri Demo Remedies", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_sukrovin_sr500", brand_name: "Sukrovin SR 500", manufacturer: "Nirmal Demo Healthcare", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "pending" },

  // --- Same salt, different formulation: never alternatives to the SR 500 group ---
  { medicine_id: "med_glucora_500", brand_name: "Glucora 500", manufacturer: "Vindhya Demo Pharma", active_ingredients: ["Metformin"], strength: "500 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_metsave_sr1000", brand_name: "Metsave SR 1000", manufacturer: "Arogya Demo Labs", active_ingredients: ["Metformin"], strength: "1000 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_metsave_g1", brand_name: "Metsave-G1 SR", manufacturer: "Arogya Demo Labs", active_ingredients: ["Metformin", "Glimepiride"], strength: "500 mg + 1 mg", dosage_form: "Tablet", release_type: "SR", verification_status: "verified", review_status: "approved" },

  // --- Telmisartan 40 mg group: no approved alternative exists ---
  { medicine_id: "med_telvia_40", brand_name: "Telvia 40", manufacturer: "Narmada Demo Labs", active_ingredients: ["Telmisartan"], strength: "40 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_telsafe_40", brand_name: "Telsafe 40", manufacturer: "Tapti Demo Pharma", active_ingredients: ["Telmisartan"], strength: "40 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },
  { medicine_id: "med_telvia_h40", brand_name: "Telvia-H 40", manufacturer: "Narmada Demo Labs", active_ingredients: ["Telmisartan", "Hydrochlorothiazide"], strength: "40 mg + 12.5 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },

  // --- Amlodipine 5 mg group: current product has no verified price ---
  { medicine_id: "med_amlocard_5", brand_name: "Amlocard 5", manufacturer: "Sabarmati Demo Pharma", active_ingredients: ["Amlodipine"], strength: "5 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },
  // --- Cetirizine 10 mg tablet group (fictional brands) ---
  { medicine_id: "med_allerfree_10", brand_name: "Allerfree 10", manufacturer: "Krishna Demo Pharma", active_ingredients: ["Cetirizine"], strength: "10 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_cetzy_10", brand_name: "Cetzy 10", manufacturer: "Betwa Demo Labs", active_ingredients: ["Cetirizine"], strength: "10 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },
  { medicine_id: "med_rhinocet_10", brand_name: "Rhinocet 10", manufacturer: "Chambal Demo Remedies", active_ingredients: ["Cetirizine"], strength: "10 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },

  { medicine_id: "med_amlonest_5", brand_name: "Amlonest 5", manufacturer: "Mahanadi Demo Labs", active_ingredients: ["Amlodipine"], strength: "5 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "approved" },
];


const CORE_PRICES: PriceSeed[] = [
  { price_id: "pr_001", medicine_id: "med_glucora_sr500", price_type: "MRP", amount: 40, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 12 },
  { price_id: "pr_002", medicine_id: "med_glucora_sr500", price_type: "SELLING_PRICE", amount: 36, pack_quantity: 10, price_source: "sample_pharmacy_feed", verification_status: "verified", verified_days_ago: 5 },
  { price_id: "pr_003", medicine_id: "med_metsave_sr500", price_type: "MRP", amount: 20, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 11 },
  { price_id: "pr_004", medicine_id: "med_metsave_sr500", price_type: "SELLING_PRICE", amount: 18, pack_quantity: 10, price_source: "sample_pharmacy_feed", verification_status: "verified", verified_days_ago: 5 },
  { price_id: "pr_005", medicine_id: "med_glyminor_sr500", price_type: "MRP", amount: 45, pack_quantity: 15, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 6 },
  { price_id: "pr_006", medicine_id: "med_duometa_sr500", price_type: "MRP", amount: 22, pack_quantity: 10, price_source: "sample_admin_entry", verification_status: "unverified", verified_days_ago: null },
  { price_id: "pr_007", medicine_id: "med_metaveda_sr500", price_type: "MRP", amount: 30, pack_quantity: 20, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 142 },
  { price_id: "pr_008", medicine_id: "med_sukrovin_sr500", price_type: "MRP", amount: 26, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 4 },
  { price_id: "pr_009", medicine_id: "med_glucora_500", price_type: "MRP", amount: 18, pack_quantity: 10, price_source: "sample_pack_mrp", verification_status: "verified", verified_days_ago: 8 },
  { price_id: "pr_010", medicine_id: "med_metsave_sr1000", price_type: "MRP", amount: 34, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 11 },
  { price_id: "pr_011", medicine_id: "med_metsave_g1", price_type: "MRP", amount: 52, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 11 },
  { price_id: "pr_012", medicine_id: "med_telvia_40", price_type: "MRP", amount: 96, pack_quantity: 14, price_source: "sample_pack_mrp", verification_status: "verified", verified_days_ago: 20 },
  { price_id: "pr_013", medicine_id: "med_telsafe_40", price_type: "MRP", amount: 60, pack_quantity: 14, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 15 },
  { price_id: "pr_014", medicine_id: "med_telvia_h40", price_type: "MRP", amount: 118, pack_quantity: 14, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 15 },
  { price_id: "pr_015", medicine_id: "med_amlocard_5", price_type: "MRP", amount: 30, pack_quantity: 10, price_source: "sample_admin_entry", verification_status: "unverified", verified_days_ago: null },
  { price_id: "pr_017", medicine_id: "med_allerfree_10", price_type: "MRP", amount: 35, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 14 },
  { price_id: "pr_018", medicine_id: "med_cetzy_10", price_type: "MRP", amount: 18, pack_quantity: 15, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 10 },
  { price_id: "pr_019", medicine_id: "med_cetzy_10", price_type: "SELLING_PRICE", amount: 16.5, pack_quantity: 15, price_source: "sample_pharmacy_feed", verification_status: "verified", verified_days_ago: 3 },
  { price_id: "pr_020", medicine_id: "med_rhinocet_10", price_type: "MRP", amount: 20, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 7 },
  { price_id: "pr_016", medicine_id: "med_amlonest_5", price_type: "MRP", amount: 15, pack_quantity: 10, price_source: "sample_manufacturer_list", verification_status: "verified", verified_days_ago: 9 },
];

// ---------------------------------------------------------------------------
// Generated groups: commonly used medicines, four fictional brands each.
// ---------------------------------------------------------------------------

type BrandState = "ok_sp" | "ok" | "stale" | "unverified" | "pending" | "rejected";

interface GroupSpec {
  key: string;
  salts: string[];
  strength: string;
  form: DosageForm;
  release: ReleaseType;
  pack: number;
  /** Price per unit of the most expensive (reference) brand, in ₹. */
  refUnit: number;
  /** Four brand states; the first brand is always approved with a verified MRP and selling price. */
  states?: [BrandState, BrandState, BrandState, BrandState];
}

const GROUPS: GroupSpec[] = [
  { key: "pcm500", salts: ["Paracetamol"], strength: "500 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 1.4 },
  { key: "pcm650", salts: ["Paracetamol"], strength: "650 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 2.1, states: ["ok_sp", "ok", "ok", "pending"] },
  { key: "atv10", salts: ["Atorvastatin"], strength: "10 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 7.2 },
  { key: "atv20", salts: ["Atorvastatin"], strength: "20 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 12.5, states: ["ok_sp", "ok", "unverified", "ok"] },
  { key: "rsv10", salts: ["Rosuvastatin"], strength: "10 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 16.8 },
  { key: "pan40", salts: ["Pantoprazole"], strength: "40 mg", form: "Tablet", release: "DR", pack: 15, refUnit: 9.6, states: ["ok_sp", "ok", "ok", "stale"] },
  { key: "ome20", salts: ["Omeprazole"], strength: "20 mg", form: "Capsule", release: "DR", pack: 15, refUnit: 4.6 },
  { key: "glm1", salts: ["Glimepiride"], strength: "1 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 5.8 },
  { key: "glm2", salts: ["Glimepiride"], strength: "2 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 9.4, states: ["ok_sp", "ok", "pending", "ok"] },
  { key: "los50", salts: ["Losartan"], strength: "50 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 6.9 },
  { key: "met50", salts: ["Metoprolol Succinate"], strength: "50 mg", form: "Tablet", release: "ER", pack: 10, refUnit: 9.9, states: ["ok_sp", "ok", "stale", "ok"] },
  { key: "amlo10", salts: ["Amlodipine"], strength: "10 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 5.1 },
  { key: "tel40a5", salts: ["Telmisartan", "Amlodipine"], strength: "40 mg + 5 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 13.2 },
  { key: "lcz5", salts: ["Levocetirizine"], strength: "5 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 5.5, states: ["ok_sp", "ok", "ok", "unverified"] },
  { key: "mlk10l5", salts: ["Montelukast", "Levocetirizine"], strength: "10 mg + 5 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 17.5 },
  { key: "azi500", salts: ["Azithromycin"], strength: "500 mg", form: "Tablet", release: "IR", pack: 3, refUnit: 39, states: ["ok_sp", "ok", "pending", "ok"] },
  { key: "amc625", salts: ["Amoxicillin", "Clavulanic Acid"], strength: "500 mg + 125 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 20.5 },
  { key: "asp75", salts: ["Aspirin"], strength: "75 mg", form: "Tablet", release: "DR", pack: 14, refUnit: 0.75 },
  { key: "clp75", salts: ["Clopidogrel"], strength: "75 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 8.1, states: ["ok_sp", "ok", "stale", "ok"] },
  { key: "ibu400", salts: ["Ibuprofen"], strength: "400 mg", form: "Tablet", release: "IR", pack: 15, refUnit: 1.6 },
  // Narrow therapeutic index: brand changes need clinical oversight, so alternatives are deliberately not approved.
  { key: "lt4_50", salts: ["Levothyroxine"], strength: "50 mcg", form: "Tablet", release: "IR", pack: 100, refUnit: 1.65, states: ["ok_sp", "rejected", "rejected", "pending"] },
  // Sample groups for the demo mode.
  { key: "pcmcaf", salts: ["Paracetamol", "Caffeine"], strength: "500 mg + 50 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 4.8, states: ["ok_sp", "ok", "ok", "pending"] },
  { key: "prx20", salts: ["Piroxicam"], strength: "20 mg", form: "Tablet", release: "IR", pack: 10, refUnit: 11.5, states: ["ok_sp", "ok", "stale", "ok"] },
];

const DEFAULT_STATES: [BrandState, BrandState, BrandState, BrandState] = ["ok_sp", "ok", "ok", "stale"];
const MULTIPLIERS = [1, 0.58, 0.74, 0.47];

const BRAND_POOL = [
  "Arovan", "Bexilo", "Corvita", "Davira", "Elmora", "Fenvia", "Galvora", "Halvex", "Irvana", "Jovira", "Kelvra", "Lumora",
  "Marvexa", "Nivora", "Ozelia", "Pravana", "Quorin", "Revalo", "Sanvira", "Tavrin", "Ulvexa", "Velora", "Wexanta", "Xelvio",
  "Yorvana", "Zenvra", "Amrevo", "Brivanta", "Calvira", "Delvaro", "Evorin", "Falveta", "Grenova", "Hexalo", "Ivanta", "Jelvra",
  "Kovana", "Lexoria", "Movira", "Navelo", "Orvanta", "Pelvora", "Quvexa", "Rovira", "Selvana", "Tarvexo", "Uvora", "Vexilo",
  "Wovira", "Xandelo", "Yelvex", "Zorvana", "Alvessa", "Bronvia", "Cyvora", "Dexalo", "Elvanta", "Fovira", "Gelvex", "Hirvana",
  "Ilvora", "Jarvexo", "Kirvana", "Larvexa", "Melvora", "Norvessa", "Ovanta", "Pirvex", "Quelvia", "Ravona", "Sivexa", "Torvana",
  "Ulvessa", "Vandora", "Wirvex", "Xorvia", "Yavira", "Zelvona", "Aqvira", "Bolvexa", "Crevana", "Dorvia", "Elvexa", "Fyrvana",
  "Gavexo", "Harvila", "Inzora", "Jupexa", "Kalvora", "Lomexa", "Mirvana", "Nexalo",
];

const MAKERS = [
  "Yamuna Demo Labs", "Teesta Demo Pharma", "Sutlej Demo Healthcare", "Beas Demo Remedies", "Kosi Demo Labs", "Pennar Demo Pharma",
  "Tungabhadra Demo Labs", "Periyar Demo Healthcare", "Vindhya Demo Pharma", "Arogya Demo Labs", "Sahyadri Demo Pharma", "Kaveri Demo Remedies",
];

const roundHalf = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);
const strengthLabel = (s: string) => s.replace(/\s*mg|\s*mcg/g, "").replace(/\s*\+\s*/g, "/");

function generate(): { medicines: MedicineRecord[]; prices: PriceSeed[] } {
  const medicines: MedicineRecord[] = [];
  const prices: PriceSeed[] = [];
  let b = 0, p = 0;
  GROUPS.forEach((g, gi) => {
    const states = g.states ?? DEFAULT_STATES;
    states.forEach((state, i) => {
      const name = `${BRAND_POOL[b++ % BRAND_POOL.length]} ${strengthLabel(g.strength)}`;
      const id = `med_${g.key}_${i + 1}`;
      medicines.push({
        medicine_id: id,
        brand_name: name,
        manufacturer: MAKERS[(gi * 3 + i) % MAKERS.length],
        active_ingredients: g.salts,
        strength: g.strength,
        dosage_form: g.form,
        release_type: g.release,
        verification_status: "verified",
        review_status: (state === "pending" ? "pending" : state === "rejected" ? "rejected" : "approved") as ReviewStatus,
      });
      const mrp = roundHalf(g.refUnit * MULTIPLIERS[i] * g.pack);
      const days = 3 + ((gi * 7 + i * 5) % 40);
      prices.push({
        price_id: `pr_${g.key}_${i + 1}_mrp`, medicine_id: id, price_type: "MRP", amount: mrp, pack_quantity: g.pack,
        price_source: i === 0 ? "sample_pack_mrp" : "sample_manufacturer_list",
        verification_status: state === "unverified" ? "unverified" : "verified",
        verified_days_ago: state === "unverified" ? null : state === "stale" ? 120 + gi * 3 : days,
      });
      if (state === "ok_sp" || (i === 1 && gi % 2 === 0)) {
        prices.push({
          price_id: `pr_${g.key}_${i + 1}_sp`, medicine_id: id, price_type: "SELLING_PRICE", amount: roundHalf(mrp * 0.9), pack_quantity: g.pack,
          price_source: "sample_pharmacy_feed", verification_status: "verified", verified_days_ago: 2 + (gi % 9),
        });
      }
      p++;
    });
  });
  return { medicines, prices };
}

const GENERATED = generate();

// ---------------------------------------------------------------------------
// REAL DATA (what the live database serves).
//
// Brands: brand, maker, composition and MRP as shown on public online pharmacy
//   listings (truemeds.in / pharmeasy.in / apollopharmacy.in), checked on LISTING_DATE.
//   Brands are both recognised as the customer's medicine and offered as branded
//   alternatives to each other (review_status "approved": same salt, strength, form
//   and release type per the listing). "pending" brands are recognised only:
//   Thyronorm (levothyroxine: switching needs a doctor), Dolonex (tablet type not
//   confirmed), Saridon (no current listing).
// Jan Aushadhi: government generic medicines from the PMBJP product list
//   (drug code, unit size, MRP; list updated 30 Aug 2026), checked on LISTING_DATE.
//   review_status "approved" means: same salt, strength, dosage form and release type
//   as the brand, per the published product names. It is not a clinical review.
//   Levothyroxine is "rejected": brand changes for this narrow-therapeutic-index drug
//   need a doctor, so no alternative is offered.
// Metoprolol is not paired: the Jan Aushadhi name does not state the salt (succinate/tartrate).
// Piroxicam is not paired: dispersible vs plain tablet could not be confirmed for the brand.
// ---------------------------------------------------------------------------
const LISTING_DATE = "2026-10-24";

type RealSpec = [id: string, brand: string, maker: string | null, salts: string[], strength: string, form: DosageForm, release: ReleaseType, mrp: number | null, pack: number, review?: ReviewStatus];

const BRANDS: RealSpec[] = [
  ["real_crocin_adv_500", "Crocin Advance 500", "GlaxoSmithKline Pharmaceuticals Ltd", ["Paracetamol"], "500 mg", "Tablet", "IR", 19.31, 20],
  ["real_dolo_650", "Dolo 650", "Micro Labs Ltd", ["Paracetamol"], "650 mg", "Tablet", "IR", 32.12, 15],
  ["real_okacet_10", "Okacet 10", "Cipla Ltd", ["Cetirizine"], "10 mg", "Tablet", "IR", 19.73, 10],
  ["real_lcet_5", "L Cet 5", "Nodysis Pharma Pvt Ltd", ["Levocetirizine"], "5 mg", "Tablet", "IR", 37.5, 10],
  ["real_glycomet_sr_500", "Glycomet SR 500", "USV Pvt Ltd", ["Metformin"], "500 mg", "Tablet", "SR", 42.24, 20],
  ["real_amaryl_1", "Amaryl 1", "Sanofi India Ltd", ["Glimepiride"], "1 mg", "Tablet", "IR", 118.44, 30],
  ["real_atorva_10", "Atorva 10", "Zydus Healthcare Ltd", ["Atorvastatin"], "10 mg", "Tablet", "IR", 80.14, 15],
  ["real_atorva_20", "Atorva 20", "Zydus Healthcare Ltd", ["Atorvastatin"], "20 mg", "Tablet", "IR", 130.93, 10],
  ["real_rosuvas_10", "Rosuvas 10", "Sun Pharma (Ranbaxy)", ["Rosuvastatin"], "10 mg", "Tablet", "IR", 375, 15],
  ["real_amlong_5", "Amlong 5", "Micro Labs Ltd", ["Amlodipine"], "5 mg", "Tablet", "IR", 47.59, 15],
  ["real_telma_40", "Telma 40", "Glenmark Pharmaceuticals Ltd", ["Telmisartan"], "40 mg", "Tablet", "IR", 108.36, 15],
  ["real_losar_50", "Losar 50", "Torrent Pharmaceuticals Ltd", ["Losartan"], "50 mg", "Tablet", "IR", 178.31, 15],
  ["real_pan_40", "Pan 40", "Alkem Laboratories Ltd", ["Pantoprazole"], "40 mg", "Tablet", "DR", 192.8, 15],
  ["real_omez_20", "Omez 20", "Dr. Reddy's Laboratories Ltd", ["Omeprazole"], "20 mg", "Capsule", "DR", 61.22, 20],
  ["real_azithral_500", "Azithral 500", "Alembic Pharmaceuticals Ltd", ["Azithromycin"], "500 mg", "Tablet", "IR", 126.73, 5],
  ["real_augmentin_duo_625", "Augmentin Duo 625", "GlaxoSmithKline Pharmaceuticals Ltd", ["Amoxicillin", "Clavulanic Acid"], "500 mg + 125 mg", "Tablet", "IR", 140.88, 6],
  ["real_ecosprin_75", "Ecosprin 75", "USV Pvt Ltd", ["Aspirin"], "75 mg", "Tablet", "DR", 5.29, 14],
  ["real_clop_75", "Clop 75", "West-Coast Pharmaceutical Works Ltd", ["Clopidogrel"], "75 mg", "Tablet", "IR", 25.78, 10],
  ["real_brufen_400", "Brufen 400", "Abbott India Ltd", ["Ibuprofen"], "400 mg", "Tablet", "IR", 25.17, 15],
  ["real_thyronorm_50", "Thyronorm 50", "Abbott India Ltd", ["Levothyroxine"], "50 mcg", "Tablet", "IR", 132.87, 120, "pending"],
  ["real_dolonex_rapid_20", "Dolonex Rapid 20", "Pfizer Ltd", ["Piroxicam"], "20 mg", "Tablet", "IR", 136.15, 10, "pending"],
  ["real_new_saridon", "New Saridon", "Bayer Pharmaceuticals Pvt Ltd", ["Paracetamol", "Caffeine"], "500 mg + 50 mg", "Tablet", "IR", 55, 10],
  ["real_saridon", "Saridon", null, ["Paracetamol", "Propyphenazone", "Caffeine"], "250 mg + 150 mg + 50 mg", "Tablet", "IR", null, 10, "pending"],
  // Branded alternatives from other makers (same listing source and date).
  ["real_calpol_650p", "Calpol 650+", "GlaxoSmithKline Pharmaceuticals Ltd", ["Paracetamol"], "650 mg", "Tablet", "IR", 32.04, 15],
  ["real_crocin_adv_650", "Crocin Advance 650", "GlaxoSmithKline Pharmaceuticals Ltd", ["Paracetamol"], "650 mg", "Tablet", "IR", 31.65, 15],
  ["real_pacimol_650", "Pacimol 650", "Ipca Laboratories Ltd", ["Paracetamol"], "650 mg", "Tablet", "IR", 32.12, 15],
  ["real_paracip_650", "Paracip 650", "Cipla Health Ltd", ["Paracetamol"], "650 mg", "Tablet", "IR", 32.28, 15],
  ["real_alerid_10", "Alerid 10", "Cipla Ltd", ["Cetirizine"], "10 mg", "Tablet", "IR", 20.16, 10],
  ["real_cetzine_10", "Cetzine 10", "Dr. Reddy's Laboratories Ltd", ["Cetirizine"], "10 mg", "Tablet", "IR", 20.16, 10],
  ["real_levocet_5", "Levocet 5", "Hetero Healthcare Ltd", ["Levocetirizine"], "5 mg", "Tablet", "IR", 52.9, 10],
  ["real_obimet_sr_500", "Obimet SR 500", "Corona Remedies Pvt Ltd", ["Metformin"], "500 mg", "Tablet", "SR", 20.44, 10],
  ["real_glyciphage_sr_500", "Glyciphage SR 500", "Franco-Indian Pharmaceuticals Pvt Ltd", ["Metformin"], "500 mg", "Tablet", "SR", 26.62, 10],
  ["real_glimestar_1", "Glimestar 1", "Mankind Pharma Ltd", ["Glimepiride"], "1 mg", "Tablet", "IR", 31.94, 10],
  ["real_glimisave_1", "Glimisave 1", "Eris Lifesciences Ltd", ["Glimepiride"], "1 mg", "Tablet", "IR", 32.78, 10],
  ["real_atorlip_10", "Atorlip 10", "Cipla Ltd", ["Atorvastatin"], "10 mg", "Tablet", "IR", 80.16, 15],
  ["real_storvas_10", "Storvas 10", "Sun Pharmaceutical Industries Ltd", ["Atorvastatin"], "10 mg", "Tablet", "IR", 80.14, 15],
  ["real_rozavel_10", "Rozavel 10", "Sun Pharma Laboratories Ltd", ["Rosuvastatin"], "10 mg", "Tablet", "IR", 211.88, 10],
  ["real_rosulip_10", "Rosulip 10", "Cipla Ltd", ["Rosuvastatin"], "10 mg", "Tablet", "IR", 364.61, 15],
  ["real_amlokind_5", "Amlokind 5", "Mankind Pharma Ltd", ["Amlodipine"], "5 mg", "Tablet", "IR", 23.82, 15],
  ["real_stamlo_5", "Stamlo 5", "Dr. Reddy's Laboratories Ltd", ["Amlodipine"], "5 mg", "Tablet", "IR", 80.51, 30],
  ["real_telmikind_40", "Telmikind 40", "Mankind Pharma Ltd", ["Telmisartan"], "40 mg", "Tablet", "IR", 61.87, 10],
  ["real_telsartan_40", "Telsartan 40", "Dr. Reddy's Laboratories Ltd", ["Telmisartan"], "40 mg", "Tablet", "IR", 99.28, 14],
  ["real_repace_50", "Repace 50", "Sun Pharma Laboratories Ltd", ["Losartan"], "50 mg", "Tablet", "IR", 106, 10],
  ["real_omee_20", "Omee 20", "Alkem Laboratories Ltd", ["Omeprazole"], "20 mg", "Capsule", "DR", 61.74, 20],
  ["real_ocid_20", "Ocid 20", "Zydus Healthcare Ltd", ["Omeprazole"], "20 mg", "Capsule", "DR", 61.69, 20],
  ["real_azee_500", "Azee 500", "Cipla Ltd", ["Azithromycin"], "500 mg", "Tablet", "IR", 126.71, 5],
  ["real_moxikind_cv_625", "Moxikind-CV 625", "Mankind Pharma Ltd", ["Amoxicillin", "Clavulanic Acid"], "500 mg + 125 mg", "Tablet", "IR", 184.14, 10],
  ["real_clavam_625", "Clavam 625", "Alkem Laboratories Ltd", ["Amoxicillin", "Clavulanic Acid"], "500 mg + 125 mg", "Tablet", "IR", 196.73, 10],
  ["real_deplatt_75", "Deplatt 75", "Torrent Pharmaceuticals Ltd", ["Clopidogrel"], "75 mg", "Tablet", "IR", 102.95, 15],
  ["real_clopilet_75", "Clopilet 75", "Sun Pharma Laboratories Ltd", ["Clopidogrel"], "75 mg", "Tablet", "IR", 107.4, 15],
  ["real_ibugesic_400", "Ibugesic 400", "Cipla Ltd", ["Ibuprofen"], "400 mg", "Tablet", "IR", 10.2, 15],
];

/** [drug code, product name as listed, salts, strength, form, release, unit size, MRP, review] */
type JaSpec = [code: number, name: string, salts: string[], strength: string, form: DosageForm, release: ReleaseType, pack: number, mrp: number, review?: ReviewStatus];

const JAN_AUSHADHI: JaSpec[] = [
  [23, "Paracetamol Tablets IP 500 mg", ["Paracetamol"], "500 mg", "Tablet", "IR", 10, 6.56],
  [511, "Paracetamol Tablets IP 650 mg", ["Paracetamol"], "650 mg", "Tablet", "IR", 15, 15.47],
  [240, "Cetirizine Hydrochloride Tablets IP 10 mg", ["Cetirizine"], "10 mg", "Tablet", "IR", 10, 5.68],
  [248, "Levocetirizine Tablets IP 5 mg", ["Levocetirizine"], "5 mg", "Tablet", "IR", 10, 7.94],
  [145, "Metformin Hydrochloride Tablets IP 500 mg", ["Metformin"], "500 mg", "Tablet", "IR", 10, 6.81],
  [372, "Metformin Hydrochloride Prolonged-release Tablets IP 500 mg", ["Metformin"], "500 mg", "Tablet", "SR", 10, 10.79],
  [137, "Glimepiride Tablets IP 1 mg", ["Glimepiride"], "1 mg", "Tablet", "IR", 10, 4.54],
  [138, "Glimepiride Tablets IP 2 mg", ["Glimepiride"], "2 mg", "Tablet", "IR", 10, 5.68],
  [266, "Atorvastatin Tablets IP 10 mg", ["Atorvastatin"], "10 mg", "Tablet", "IR", 10, 9.08],
  [267, "Atorvastatin Tablets IP 20 mg", ["Atorvastatin"], "20 mg", "Tablet", "IR", 10, 12.47],
  [759, "Rosuvastatin Tablets IP 10 mg", ["Rosuvastatin"], "10 mg", "Tablet", "IR", 15, 19.28],
  [264, "Amlodipine Tablets IP 5 mg", ["Amlodipine"], "5 mg", "Tablet", "IR", 10, 5.68],
  [300, "Telmisartan Tablets IP 40 mg", ["Telmisartan"], "40 mg", "Tablet", "IR", 10, 12.38],
  [289, "Losartan Tablets IP 50 mg", ["Losartan"], "50 mg", "Tablet", "IR", 10, 12.47],
  [212, "Pantoprazole Gastro-resistant Tablets IP 40 mg", ["Pantoprazole"], "40 mg", "Tablet", "DR", 10, 12.47],
  [207, "Omeprazole Gastro-resistant Capsules IP 20 mg", ["Omeprazole"], "20 mg", "Capsule", "DR", 10, 10.21],
  [72, "Azithromycin Tablets IP 500 mg", ["Azithromycin"], "500 mg", "Tablet", "IR", 3, 39.38],
  [39, "Amoxycillin 500 mg and Potassium Clavulanate 125 mg Tablets IP", ["Amoxicillin", "Clavulanic Acid"], "500 mg + 125 mg", "Tablet", "IR", 6, 57.85],
  [790, "Aspirin Enteric-coated Tablets IP 75 mg", ["Aspirin"], "75 mg", "Tablet", "DR", 14, 2.81],
  [269, "Clopidogrel Tablets IP 75 mg", ["Clopidogrel"], "75 mg", "Tablet", "IR", 10, 19.28],
  [16, "Ibuprofen Tablets IP 400 mg", ["Ibuprofen"], "400 mg", "Tablet", "IR", 15, 9.08],
  [1221, "Thyroxine Sodium Tablets IP 50 mcg", ["Levothyroxine"], "50 mcg", "Tablet", "IR", 100, 55.65, "rejected"],
];

const REAL_MEDICINES: MedicineRecord[] = [
  ...BRANDS.map(([id, brand, maker, salts, strength, form, release, , , review]): MedicineRecord => ({
    medicine_id: id, brand_name: brand, manufacturer: maker, active_ingredients: salts, strength, dosage_form: form, release_type: release, verification_status: "verified", review_status: review ?? "approved",
  })),
  ...JAN_AUSHADHI.map(([code, name, salts, strength, form, release, , , review]): MedicineRecord => ({
    medicine_id: `ja_${code}`, brand_name: `Jan Aushadhi ${name}`, manufacturer: `PMBI (Jan Aushadhi) · drug code ${code}`, active_ingredients: salts, strength, dosage_form: form, release_type: release, verification_status: "verified", review_status: review ?? "approved",
  })),
];

const REAL_PRICES: PriceSeed[] = [
  ...BRANDS.filter((b) => b[7] != null).map(([id, , , , , , , mrp, pack]): PriceSeed => ({
    price_id: `pr_${id}`, medicine_id: id, price_type: "MRP", amount: mrp!, pack_quantity: pack, price_source: "public_listing", verification_status: "verified", verified_days_ago: null, verified_on: LISTING_DATE,
  })),
  ...JAN_AUSHADHI.map(([code, , , , , , pack, mrp]): PriceSeed => ({
    price_id: `pr_ja_${code}`, medicine_id: `ja_${code}`, price_type: "MRP", amount: mrp, pack_quantity: pack, price_source: "jan_aushadhi_list", verification_status: "verified", verified_days_ago: null, verified_on: LISTING_DATE,
  })),
];

/** True for rows that are real-world data (served by the live database). */
export const isRealRecord = (id: string) => id.startsWith("real_") || id.startsWith("ja_");

export const MEDICINES: MedicineRecord[] = [...CORE_MEDICINES, ...GENERATED.medicines, ...REAL_MEDICINES];
export const PRICE_SEED: PriceSeed[] = [...CORE_PRICES, ...GENERATED.prices, ...REAL_PRICES];

export function buildPriceRecords(now: Date = new Date()): PriceRecord[] {
  return PRICE_SEED.map(({ verified_days_ago, verified_on, ...p }) => ({
    ...p,
    last_verified_at: verified_on ?? (verified_days_ago == null ? null : isoDaysAgo(verified_days_ago, now)),
  }));
}
