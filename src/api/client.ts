// The only module the UI talks to for data. Today every call is served by the
// in-browser mock below. To connect the real backend, implement `DawaApi` with
// fetch() calls to the endpoints noted on each method and export it as `api`.
// The UI does not need to change.

import { ComparisonResponse, Extraction, MedicineRecord, VerificationResult } from "../domain/types";
import { SCENARIOS, ScenarioId } from "../mock/scenarios";
import { photoToDataUrl } from "../lib/image";
import { createSeedStore, CatalogueInfo } from "../catalogue/store";
import { comparisonWithStore, searchWithStore, verifyWithStore } from "../catalogue/service";

export type VisionError = "not_medicine" | "too_large" | "decode_failed" | "not_configured" | "vision_failed" | "no_credit" | "bad_key" | "rate_limited" | "model_unavailable";

/** Maps OpenAI error codes (relayed by /api/identify) to messages the app can explain. */
function visionErrorFrom(j: any): VisionError {
  const code = String(j?.code ?? "");
  if (j?.error === "too_large") return "too_large";
  if (j?.error === "not_configured") return "not_configured";
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") return "no_credit";
  if (code === "invalid_api_key" || j?.status === 401) return "bad_key";
  if (code === "rate_limit_exceeded" || j?.status === 429) return "rate_limited";
  if (code === "model_not_found" || j?.status === 404) return "model_unavailable";
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

export interface DawaApi {
  /** Planned: POST /api/identify (multipart photo) → backend calls OpenAI Vision → Extraction. */
  identifyFromPhoto(photo: Blob | null, demoScenario: ScenarioId): Promise<Extraction>;
  /** True when the deployment has a configured /api/identify (OpenAI Vision). */
  visionAvailable(): Promise<boolean>;
  /** POST /api/identify: real reading by OpenAI Vision. Rejects with Error(VisionError). */
  identifyWithVision(photo: Blob): Promise<Extraction>;
  /** Which catalogue answers: the deployment's database/API, or the copy bundled in the page. */
  catalogueInfo(): Promise<CatalogueInfo & { via: "api" | "bundled" }>;
  /** POST /api/catalogue {action:"verify"}: Verification Layer against the medicines table. */
  verify(extraction: Extraction): Promise<VerificationResult>;
  /** GET /api/catalogue?action=search&q= : catalogue search for manual entry. */
  searchCatalogue(query: string): Promise<MedicineRecord[]>;
  /** GET /api/catalogue?action=comparison&id= : approved, eligible alternatives with stored prices. */
  getComparison(medicineId: string): Promise<ComparisonResponse>;
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
const onDeployment = () => typeof location !== "undefined" && /^https?:$/.test(location.protocol) && !(window as any).claude;

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
    if (typeof location === "undefined" || !/^https?:$/.test(location.protocol) || (window as any).claude) return false;
    try {
      const r = await fetch("/api/identify", { method: "GET", headers: { Accept: "application/json" } });
      if (!r.ok) return false;
      const j = await r.json();
      return j?.configured === true;
    } catch {
      return false;
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
    if (!r.ok) {
      const err: any = new Error(visionErrorFrom(j));
      err.detail = [j?.status, j?.code, j?.detail].filter(Boolean).join(" · ");
      throw err;
    }
    if (j?.result?.is_medicine_pack === false) throw new Error("not_medicine");
    return toExtraction(j?.result);
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
};

export const api: DawaApi = mockApi;
