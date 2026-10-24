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
  // Sample alternatives for the real brands below.
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
// REAL BRANDS (identification only). Brand, maker and composition as shown on public
// online pharmacy listings; MRP from those listings, checked on the date given.
// review_status is "pending": no review has been done, so they are never offered as
// alternatives. They can be identified as the customer's current medicine.
// ---------------------------------------------------------------------------
const PUBLIC_LISTING_DATE = "2026-10-24";

const REAL_MEDICINES: MedicineRecord[] = [
  { medicine_id: "real_crocin_adv_500", brand_name: "Crocin Advance 500", manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", active_ingredients: ["Paracetamol"], strength: "500 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },
  { medicine_id: "real_okacet_10", brand_name: "Okacet 10", manufacturer: "Cipla Ltd", active_ingredients: ["Cetirizine"], strength: "10 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },
  { medicine_id: "real_dolonex_rapid_20", brand_name: "Dolonex Rapid 20", manufacturer: "Pfizer Ltd", active_ingredients: ["Piroxicam"], strength: "20 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },
  { medicine_id: "real_new_saridon", brand_name: "New Saridon", manufacturer: "Bayer Pharmaceuticals Pvt Ltd", active_ingredients: ["Paracetamol", "Caffeine"], strength: "500 mg + 50 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },
  { medicine_id: "real_saridon", brand_name: "Saridon", manufacturer: null, active_ingredients: ["Paracetamol", "Propyphenazone", "Caffeine"], strength: "250 mg + 150 mg + 50 mg", dosage_form: "Tablet", release_type: "IR", verification_status: "verified", review_status: "pending" },
];

const REAL_PRICES: PriceSeed[] = [
  { price_id: "pr_real_crocin_adv_500", medicine_id: "real_crocin_adv_500", price_type: "MRP", amount: 19.31, pack_quantity: 20, price_source: "public_listing", verification_status: "verified", verified_days_ago: null, verified_on: PUBLIC_LISTING_DATE },
  { price_id: "pr_real_okacet_10", medicine_id: "real_okacet_10", price_type: "MRP", amount: 19.73, pack_quantity: 10, price_source: "public_listing", verification_status: "verified", verified_days_ago: null, verified_on: PUBLIC_LISTING_DATE },
  { price_id: "pr_real_dolonex_rapid_20", medicine_id: "real_dolonex_rapid_20", price_type: "MRP", amount: 136.15, pack_quantity: 10, price_source: "public_listing", verification_status: "verified", verified_days_ago: null, verified_on: PUBLIC_LISTING_DATE },
  { price_id: "pr_real_new_saridon", medicine_id: "real_new_saridon", price_type: "MRP", amount: 55, pack_quantity: 10, price_source: "public_listing", verification_status: "verified", verified_days_ago: null, verified_on: PUBLIC_LISTING_DATE },
  // Classic Saridon: no current listing found, so no price is stored.
];

export const MEDICINES: MedicineRecord[] = [...CORE_MEDICINES, ...GENERATED.medicines, ...REAL_MEDICINES];
export const PRICE_SEED: PriceSeed[] = [...CORE_PRICES, ...GENERATED.prices, ...REAL_PRICES];

export function buildPriceRecords(now: Date = new Date()): PriceRecord[] {
  return PRICE_SEED.map(({ verified_days_ago, verified_on, ...p }) => ({
    ...p,
    last_verified_at: verified_on ?? (verified_days_ago == null ? null : isoDaysAgo(verified_days_ago, now)),
  }));
}
