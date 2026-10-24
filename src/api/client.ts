// The only module the UI talks to for data. Today every call is served by the
// in-browser mock below. To connect the real backend, implement `DawaApi` with
// fetch() calls to the endpoints noted on each method and export it as `api`.
// The UI does not need to change.

import { ComparisonResponse, Extraction, Formulation, MedicineRecord, VerificationResult } from "../domain/types";
import { DEMO } from "../lib/mode";
import { SCENARIOS, ScenarioId } from "../mock/scenarios";
import { photoToDataUrl } from "../lib/image";
import { createSeedStore, CatalogueInfo } from "../catalogue/store";
import { comparisonWithStore, formulationComparisonWithStore, searchWithStore, verifyWithStore } from "../catalogue/service";

export type VisionError = "not_medicine" | "not_recognised" | "too_large" | "decode_failed" | "busy" | "vision_failed";

/** What the AI identified: the fields the Verification Layer checks, plus the company name for display. */
export interface Identified { extraction: Extraction; maker: string | null }

/** Only reasons the customer can act on are distinguished; every service-side problem is "vision_failed". */
function visionErrorFrom(j: any): VisionError {
  if (j?.error === "too_large") return "too_large";
  if (j?.error === "busy") return "busy";
  return "vision_failed";
}

const READS = ["clear", "unclear", "not_found"];

/** Maps the server's vision result to an Extraction, dropping anything malformed. */
export function toExtraction(r: any): Extraction {
  const f = (k: string) => {
    const v = r?.[k];
    const value = typeof v?.value === "string" && v.value.trim() ? v.value.trim() : null;
    const read = READS.includes(v?.read) ? v.read : "unclear";
    return { value, read: value ? read : "not_found" } as Extraction["brand_name"];
  };
  return { brand_name: f("brand_name"), active_ingredients: f("active_ingredients"), strength: f("strength"), dosage_form: f("dosage_form"), release_type: f("release_type") };
}

export function toIdentified(r: any): Identified {
  const m = typeof r?.manufacturer?.value === "string" ? r.manufacturer.value.trim() : "";
  return { extraction: toExtraction(r), maker: m || null };
}

export interface DawaApi {
  /** Planned: POST /api/identify (multipart photo) → backend calls OpenAI Vision → Extraction. */
  identifyFromPhoto(photo: Blob | null, demoScenario: ScenarioId): Promise<Extraction>;
  /** The configured vision provider ("gemini" | "openai") on this deployment, or null. */
  visionAvailable(): Promise<string | null>;
  /** POST /api/identify {image}: real reading by the vision model. Rejects with Error(VisionError). */
  identifyWithVision(photo: Blob): Promise<Identified>;
  /** POST /api/identify {text}: identifies a typed medicine name that isn't in the catalogue. Rejects with Error(VisionError). */
  identifyByName(name: string): Promise<Identified>;
  /** Which catalogue answers: the deployment's database/API, or the copy bundled in the page. */
  catalogueInfo(): Promise<CatalogueInfo & { via: "api" | "bundled" }>;
  /** POST /api/catalogue {action:"verify"}: Verification Layer against the medicines table. */
  verify(extraction: Extraction): Promise<VerificationResult>;
  /** GET /api/catalogue?action=search&q= : catalogue search for manual entry. */
  searchCatalogue(query: string): Promise<MedicineRecord[]>;
  /** GET /api/catalogue?action=comparison&id= : approved, eligible alternatives with stored prices. */
  getComparison(medicineId: string): Promise<ComparisonResponse>;
  /** GET /api/catalogue?action=formulation : alternatives for a formulation confirmed from the customer's pack. */
  getFormulationComparison(f: Formulation): Promise<Omit<ComparisonResponse, "current">>;
  /** POST /api/feedback : a feedback answer or a usage event. Resolves false if not stored. */
  sendFeedback(payload: Record<string, unknown>): Promise<boolean>;
  /** GET /api/feedback?action=stats : public usage counts, or null when unavailable. */
  usageStats(): Promise<{ checks: number } | null>;
}

export const SIMULATED = {
  vision: true,
  catalogue: true,
  prices: true,
} as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const latency = (ms: number) => wait(reduceMotion() ? Math.min(ms, 250) : ms);

const bundled = createSeedStore();
// The live site uses its API (real catalogue). Demo mode (artifact, local file, ?demo) uses the bundled data.
const onDeployment = () => !DEMO && typeof location !== "undefined" && /^https?:$/.test(location.protocol);

/** Probes /api/catalogue once. On a deployment it answers from PostgreSQL (or its own seed copy). */
let backend: Promise<(CatalogueInfo & { via: "api" }) | null> | null = null;
function catalogueBackend() {
  backend ??= (async () => {
    if (!onDeployment()) return null;
    try {
      const r = await fetch("/api/catalogue?action=status", { headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.source ? { ...j, via: "api" as const } : null;
    } catch {
      return null;
    }
  })();
  return backend;
}

async function getJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error ?? "catalogue_error");
  return j;
}

export const mockApi: DawaApi = {
  async identifyFromPhoto(_photo, demoScenario) {
    // The photo is never read or sent anywhere. A predefined reading is returned.
    await latency(900);
    return JSON.parse(JSON.stringify(SCENARIOS[demoScenario]));
  },

  async visionAvailable() {
    // Only a real deployment (e.g. Vercel) has the /api route. File previews and the Claude artifact don't.
    if (!onDeployment()) return null;
    try {
      const r = await fetch("/api/identify", { method: "GET", headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.configured === true ? String(j.provider ?? "openai") : null;
    } catch {
      return null;
    }
  },

  async identifyWithVision(photo) {
    let image: string;
    try { image = await photoToDataUrl(photo); } catch { throw new Error("decode_failed"); }
    let r: Response;
    try {
      r = await fetch("/api/identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
    } catch {
      throw new Error("vision_failed");
    }
    const j: any = await r.json().catch(() => null);
    if (!r.ok) throw new Error(visionErrorFrom(j));
    if (j?.result?.is_medicine_pack === false) throw new Error("not_medicine");
    return toIdentified(j?.result);
  },

  async identifyByName(name) {
    let r: Response;
    try {
      r = await fetch("/api/identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: name }) });
    } catch {
      throw new Error("vision_failed");
    }
    const j: any = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error === "bad_text" ? "not_recognised" : visionErrorFrom(j));
    const out = toIdentified(j?.result);
    if (j?.result?.recognized === false || !out.extraction.active_ingredients.value) throw new Error("not_recognised");
    // Identified from general knowledge, not read from a pack: every field must be checked by the customer.
    for (const k of Object.keys(out.extraction) as (keyof Extraction)[]) if (out.extraction[k].value) out.extraction[k].read = "unclear";
    return out;
  },

  async catalogueInfo() {
    return (await catalogueBackend()) ?? { ...(await bundled.describe()), via: "bundled" as const };
  },

  async verify(extraction) {
    if (await catalogueBackend()) {
      return getJson("/api/catalogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", extraction }) });
    }
    await latency(500);
    return verifyWithStore(bundled, extraction);
  },

  async searchCatalogue(query) {
    if (await catalogueBackend()) return getJson(`/api/catalogue?action=search&q=${encodeURIComponent(query)}`);
    await latency(250);
    return searchWithStore(bundled, query);
  },

  async getComparison(medicineId) {
    if (await catalogueBackend()) return getJson(`/api/catalogue?action=comparison&id=${encodeURIComponent(medicineId)}`);
    await latency(700);
    return comparisonWithStore(bundled, medicineId);
  },

  async getFormulationComparison(f) {
    if (await catalogueBackend()) {
      const q = new URLSearchParams({ action: "formulation", ingredients: f.active_ingredients.join("|"), strength: f.strength, form: f.dosage_form, release: f.release_type });
      return getJson(`/api/catalogue?${q}`);
    }
    await latency(500);
    return formulationComparisonWithStore(bundled, f);
  },

  async sendFeedback(payload) {
    if (!onDeployment()) return false;
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
      return r.ok;
    } catch {
      return false;
    }
  },

  async usageStats() {
    if (!onDeployment()) return null;
    try {
      const r = await fetch("/api/feedback?action=stats", { headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const j = await r.json();
      return typeof j?.checks === "number" ? { checks: j.checks } : null;
    } catch {
      return null;
    }
  },
};

export const api: DawaApi = mockApi;
