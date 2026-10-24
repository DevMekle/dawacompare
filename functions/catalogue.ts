// Vercel serverless function: /api/catalogue
//   GET  ?action=status                 → { source: "postgres" | "seed", medicines, prices }
//   GET  ?action=search&q=cetirizine    → MedicineRecord[]
//   GET  ?action=comparison&id=med_...  → ComparisonResponse (approved, eligible alternatives + stored prices)
//   GET  ?action=formulation&ingredients=A|B&strength=..&form=Tablet&release=IR → alternatives for a pack-confirmed formulation
//   POST { action: "verify", extraction } → VerificationResult
// Reads from PostgreSQL when DATABASE_URL is set; otherwise serves the bundled sample catalogue.

import { getStore } from "../server/getStore";
import { comparisonWithStore, formulationComparisonWithStore, searchWithStore, verifyWithStore } from "../src/catalogue/service";
import { CRITICAL_FIELDS, Extraction } from "../src/domain/types";

type Req = { method?: string; url?: string; body?: any };
type Res = { status: (code: number) => Res; json: (body: unknown) => void; setHeader: (k: string, v: string) => void };

function parseExtraction(x: any): Extraction | null {
  if (!x || typeof x !== "object") return null;
  const out = {} as Extraction;
  for (const f of CRITICAL_FIELDS) {
    const v = x[f];
    const value = typeof v?.value === "string" && v.value.length <= 200 ? v.value : null;
    const read = ["clear", "unclear", "not_found", "user"].includes(v?.read) ? v.read : "unclear";
    out[f] = { value, read: value ? read : "not_found" };
  }
  return out;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    const store = getStore();
    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      if (action === "status") return res.status(200).json(await store.describe());
      if (action === "search") return res.status(200).json(await searchWithStore(store, (url.searchParams.get("q") ?? "").slice(0, 100)));
      if (action === "comparison") {
        const id = url.searchParams.get("id") ?? "";
        try {
          return res.status(200).json(await comparisonWithStore(store, id));
        } catch (e: any) {
          if (e?.message === "not_found") return res.status(404).json({ error: "not_found" });
          throw e;
        }
      }
      if (action === "formulation") {
        const ingredients = (url.searchParams.get("ingredients") ?? "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 5);
        const strength = (url.searchParams.get("strength") ?? "").slice(0, 60);
        const form = url.searchParams.get("form");
        const release = url.searchParams.get("release");
        if (!ingredients.length || !strength || !["Tablet", "Capsule"].includes(form ?? "") || !["IR", "SR", "ER", "MR", "DR"].includes(release ?? "")) {
          return res.status(400).json({ error: "bad_formulation" });
        }
        return res.status(200).json(await formulationComparisonWithStore(store, { active_ingredients: ingredients, strength, dosage_form: form as any, release_type: release as any }));
      }
      return res.status(400).json({ error: "unknown_action" });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (body?.action !== "verify") return res.status(400).json({ error: "unknown_action" });
      const ex = parseExtraction(body.extraction);
      if (!ex) return res.status(400).json({ error: "bad_extraction" });
      return res.status(200).json(await verifyWithStore(store, ex));
    }
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    console.error("catalogue error", e);
    return res.status(500).json({ error: "catalogue_error" });
  }
}
