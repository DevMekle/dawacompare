// Vercel serverless function: POST /api/identify
// Sends the medicine photo to the OpenAI Vision model and returns only the
// printed details DawaCompare needs. The photo is not stored anywhere by this function.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   OPENAI_API_KEY  required
//   OPENAI_MODEL    optional, defaults to DEFAULT_MODEL below
//
// GET /api/identify returns { configured: boolean } so the app knows whether live reading is available.

const DEFAULT_MODEL = "gpt-5.4-mini";
/** Tried once if the first model is not available to this API key. */
const FALLBACK_MODEL = "gpt-4.1-mini";
const MAX_DATA_URL_CHARS = 4_000_000; // stays under Vercel's 4.5 MB request limit

const field = (valueSchema: object) => ({
  type: "object",
  additionalProperties: false,
  required: ["value", "read"],
  properties: {
    value: valueSchema,
    read: { type: "string", enum: ["clear", "unclear", "not_found"] },
  },
});

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_medicine_pack", "brand_name", "active_ingredients", "strength", "dosage_form", "release_type"],
  properties: {
    is_medicine_pack: { type: "boolean" },
    brand_name: field({ type: ["string", "null"] }),
    active_ingredients: field({ type: ["string", "null"] }),
    strength: field({ type: ["string", "null"] }),
    dosage_form: field({ type: ["string", "null"], enum: ["Tablet", "Capsule", "Other", null] }),
    release_type: field({ type: ["string", "null"], enum: ["IR", "SR", "ER", "MR", "DR", null] }),
  },
};

const INSTRUCTIONS = `You read medicine packaging photographed by a user in India.
Extract ONLY what is printed on the pack. Never guess, infer or fill in from general knowledge.

- brand_name: the trade name exactly as printed, without the strength unless it is part of the name (e.g. "Cetimac").
- active_ingredients: the salt name(s) as printed, joined with " + " for combinations. Drop pharmacopoeia marks like I.P., B.P., U.S.P. (e.g. "Cetirizine").
- strength: amount per unit with unit, e.g. "10 mg" or "40 mg + 12.5 mg".
- dosage_form: "Tablet", "Capsule", or "Other".
- release_type: use a code ONLY if a release marking is printed: SR (sustained), ER (ER/XR/extended/prolonged), MR (MR/CR/modified/controlled), DR (DR/EC/delayed/enteric-coated), IR only if "immediate release" is printed. If no marking is printed, value null and read "not_found".
- read: "clear" if the text is plainly legible, "unclear" if partly obscured, blurred or you are not certain, "not_found" if not visible (value null).
- is_medicine_pack: false if the photo is not a medicine strip, bottle or box; then set every value null and read "not_found".
Do not give any medical advice.`;

type Req = { method?: string; body?: any };
type Res = { status: (code: number) => Res; json: (body: unknown) => void; setHeader: (k: string, v: string) => void };

function outputText(data: any): string | null {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.OPENAI_API_KEY;

  if (req.method === "GET") return res.status(200).json({ configured: !!key });
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!key) return res.status(503).json({ error: "not_configured" });

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const image: unknown = body?.image;
  if (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image)) {
    return res.status(400).json({ error: "bad_image" });
  }
  if (image.length > MAX_DATA_URL_CHARS) return res.status(413).json({ error: "too_large" });

  const first = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  try {
    let model = first;
    let { r, data } = await callOpenAI(key, model, image);
    if (!r.ok && (data?.error?.code === "model_not_found" || r.status === 404) && first !== FALLBACK_MODEL) {
      model = FALLBACK_MODEL;
      ({ r, data } = await callOpenAI(key, model, image));
    }
    if (!r.ok) {
      const code = String(data?.error?.code ?? data?.error?.type ?? "");
      console.error("OpenAI error", r.status, code, data?.error?.message);
      // Pass back only OpenAI's error code and a key-free message so the app can explain the failure.
      return res.status(502).json({ error: "vision_failed", status: r.status, code, detail: scrub(String(data?.error?.message ?? "")).slice(0, 200), model });
    }
    const text = outputText(data);
    const parsed = text ? safeParse(text) : null;
    if (!parsed) return res.status(502).json({ error: "vision_unreadable", model });
    return res.status(200).json({ model, result: parsed });
  } catch (e) {
    console.error("identify failed", e);
    return res.status(502).json({ error: "vision_failed", code: "network" });
  }
}

/** Removes anything that looks like an API key from text we return. */
function scrub(s: string): string {
  return s.replace(/sk-[A-Za-z0-9_\-*.]{2,}/g, "[key]");
}

async function callOpenAI(key: string, model: string, image: string) {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extract the printed medicine details from this pack." },
              { type: "input_image", image_url: image, detail: "high" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "medicine_pack", strict: true, schema: SCHEMA } },
        store: false,
      }),
    });
    const data: any = await r.json().catch(() => null);
    return { r, data };
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
