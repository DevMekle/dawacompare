// Vercel serverless function: POST /api/identify
// { image }: sends the medicine photo to a vision model and returns only the printed details
// DawaCompare needs. The photo is not stored anywhere by this function.
// { text }: identifies a medicine from the name the customer typed (for names not in the catalogue).
//
// Providers (set in Vercel → Project → Settings → Environment Variables):
//   GEMINI_API_KEY   Google Gemini (has a free tier; key from aistudio.google.com)
//   GEMINI_MODEL     optional, tried before GEMINI_MODELS
//   OPENAI_API_KEY   OpenAI (paid credits)
//   OPENAI_MODEL     optional, tried before OPENAI_MODELS
//   VISION_PROVIDER  optional: "gemini" or "openai". If unset, Gemini is used when its key exists.
//
// GET /api/identify returns { configured, provider } so the app knows whether live reading is available.
// Failure reasons (no credit, bad key, quota…) are written to the function logs only, never sent to customers.

// Models are tried in order until one answers. A model that is retired (404) or out of
// free quota (429, Gemini) is skipped. GEMINI_MODEL / OPENAI_MODEL, if set, are tried first.
const OPENAI_MODELS = ["gpt-5.4-mini", "gpt-4.1-mini"];
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"];
const MAX_DATA_URL_CHARS = 4_000_000; // stays under Vercel's 4.5 MB request limit

type Provider = "gemini" | "openai";

export const INSTRUCTIONS = `You read medicine packaging photographed by a user in India.
Extract ONLY what is printed on the pack. Never guess, infer or fill in from general knowledge.

- brand_name: the trade name exactly as printed, without the strength unless it is part of the name (e.g. "Cetimac"). If the pack has no trade name and is sold under its salt name (e.g. "Cetirizine Tablets IP 10 mg"), give the salt name.
- manufacturer: the company that markets the product ("Marketed by"), or the manufacturer if no marketer is printed, e.g. "Cadila Pharmaceuticals Ltd".
- active_ingredients: the salt name(s) as printed, joined with " + " for combinations. Drop pharmacopoeia marks like I.P., B.P., U.S.P. (e.g. "Cetirizine").
- strength: amount per unit with unit, e.g. "10 mg" or "40 mg + 12.5 mg".
- dosage_form: "Tablet", "Capsule", "Syrup" (any oral liquid: syrup, suspension, drops), or "Other" (cream, gel, injection, inhaler, sachet…).
- release_type: use a code ONLY if a release marking is printed: SR (sustained), ER (ER/XR/extended/prolonged), MR (MR/CR/modified/controlled), DR (DR/EC/delayed/enteric-coated), IR only if "immediate release" is printed. If no marking is printed, value null and read "not_found".
- read: "clear" if the text is plainly legible, "unclear" if partly obscured, blurred or you are not certain, "not_found" if not visible (value null).
- is_medicine_pack: false if the photo is not a medicine strip, bottle or box; then set every value null and read "not_found".
- recognized: same as is_medicine_pack.
Return JSON only. Do not give any medical advice.`;

/** Typed name → product. Uses general knowledge, so the app asks the customer to check every detail against the pack. */
export const NAME_INSTRUCTIONS = `A user in India typed the name of a medicine they buy. Identify the specific product sold in India under that name.
- recognized: true only if you know a medicine product sold in India by this name (allow small spelling mistakes). false for anything else, for a name you do not know, or if you are unsure; then set every value null and read "not_found".
- brand_name: the product's correct name, without the strength unless it is part of the name (e.g. "Telcure"). For a generic typed by salt, the salt name.
- manufacturer: the company that markets it, if you know it; otherwise null.
- active_ingredients: the salt(s), joined with " + " for combinations (e.g. "Telmisartan").
- strength: per unit with unit (e.g. "40 mg"). Use the strength typed by the user if given; if not typed and the product has several strengths, null.
- dosage_form: "Tablet", "Capsule", "Syrup" (any oral liquid: syrup, suspension, drops), or "Other" (cream, gel, injection, inhaler, sachet…).
- release_type: SR, ER, MR or DR only if the product name or the product itself is sustained/extended/modified/delayed release (e.g. "SR", "XR", "CR", "OD", "EC" in the name); IR if it is a plain tablet or capsule; null if unsure.
- read: "clear" if you are confident about that field, "unclear" if not, "not_found" when the value is null.
- is_medicine_pack: true when recognized is true.
Return JSON only. Do not give any medical advice.`;

const FIELDS = ["brand_name", "manufacturer", "active_ingredients", "strength", "dosage_form", "release_type"] as const;
const ENUMS: Record<string, string[]> = { dosage_form: ["Tablet", "Capsule", "Syrup", "Other"], release_type: ["IR", "SR", "ER", "MR", "DR"] };

// OpenAI: strict JSON schema
const openaiField = (k: string) => ({
  type: "object",
  additionalProperties: false,
  required: ["value", "read"],
  properties: {
    value: ENUMS[k] ? { type: ["string", "null"], enum: [...ENUMS[k], null] } : { type: ["string", "null"] },
    read: { type: "string", enum: ["clear", "unclear", "not_found"] },
  },
});
const OPENAI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_medicine_pack", "recognized", ...FIELDS],
  properties: { is_medicine_pack: { type: "boolean" }, recognized: { type: "boolean" }, ...Object.fromEntries(FIELDS.map((k) => [k, openaiField(k)])) },
};

// Gemini: OpenAPI-style response schema. Kept to plain types (no enums) for broad model support;
// allowed values are stated in the instructions and normalised by the app afterwards.
const geminiField = (_k: string) => ({
  type: "OBJECT",
  required: ["value", "read"],
  properties: { value: { type: "STRING", nullable: true }, read: { type: "STRING" } },
});
const GEMINI_SCHEMA = {
  type: "OBJECT",
  required: ["is_medicine_pack", "recognized", ...FIELDS],
  properties: { is_medicine_pack: { type: "BOOLEAN" }, recognized: { type: "BOOLEAN" }, ...Object.fromEntries(FIELDS.map((k) => [k, geminiField(k)])) },
};

type Req = { method?: string; body?: any };
type Res = { status: (code: number) => Res; json: (body: unknown) => void; setHeader: (k: string, v: string) => void };
type Call = { ok: boolean; status: number; code: string; message: string; text: string | null };
type Job = { instructions: string; prompt: string; image?: { dataUrl: string; mime: string; base64: string } };

function pickProvider(): { provider: Provider; key: string } | null {
  const gemini = process.env.GEMINI_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  const want = (process.env.VISION_PROVIDER || "").toLowerCase();
  if (want === "openai" && openai) return { provider: "openai", key: openai };
  if (want === "gemini" && gemini) return { provider: "gemini", key: gemini };
  if (gemini) return { provider: "gemini", key: gemini };
  if (openai) return { provider: "openai", key: openai };
  return null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  const chosen = pickProvider();

  if (req.method === "GET") return res.status(200).json({ configured: !!chosen, provider: chosen?.provider ?? null });
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!chosen) return res.status(503).json({ error: "not_configured" });

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const { provider, key } = chosen;
  let job: Job;
  if (typeof body?.text === "string") {
    // Typed name: letters, digits and simple punctuation only, 2–80 characters.
    const text = body.text.replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 80 || !/^[\p{L}\p{N} .,+\-/()%&']+$/u.test(text)) return res.status(400).json({ error: "bad_text" });
    job = { instructions: NAME_INSTRUCTIONS, prompt: `Medicine name typed by the user: "${text}"` };
  } else {
    const image: unknown = body?.image;
    const m = typeof image === "string" ? image.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/) : null;
    if (!m) return res.status(400).json({ error: "bad_image" });
    if ((image as string).length > MAX_DATA_URL_CHARS) return res.status(413).json({ error: "too_large" });
    job = { instructions: INSTRUCTIONS, prompt: "Extract the printed medicine details from this pack.", image: { dataUrl: image as string, mime: m[1], base64: m[2] } };
  }

  const preferred = provider === "gemini" ? process.env.GEMINI_MODEL : process.env.OPENAI_MODEL;
  const models = Array.from(new Set([preferred, ...(provider === "gemini" ? GEMINI_MODELS : OPENAI_MODELS)].filter(Boolean) as string[]));
  const call = (model: string) => (provider === "gemini" ? callGemini(key, model, job) : callOpenAI(key, model, job));
  const skippable = (o: Call) => o.status === 404 || o.code === "model_not_found" || o.code === "NOT_FOUND" || (provider === "gemini" && o.status === 429);

  try {
    let model = models[0];
    let out = await call(model);
    for (let i = 1; i < models.length && !out.ok && skippable(out); i++) {
      console.warn(`Vision model skipped: provider=${provider} model=${model} status=${out.status} code=${out.code}`);
      model = models[i];
      out = await call(model);
    }
    if (!out.ok) {
      console.error(`Vision error: provider=${provider} status=${out.status} code=${out.code} model=${model} message=${scrub(out.message)}`);
      const busy = out.status === 429 && out.code !== "insufficient_quota";
      return res.status(502).json({ error: busy ? "busy" : "vision_failed" });
    }
    const parsed = out.text ? safeParse(out.text) : null;
    if (!parsed) {
      console.error(`Vision returned no parsable result: provider=${provider} model=${model}`);
      return res.status(502).json({ error: "vision_failed" });
    }
    return res.status(200).json({ provider, model, result: parsed });
  } catch (e) {
    console.error("identify failed", e);
    return res.status(502).json({ error: "vision_failed" });
  }
}

/** Removes anything that looks like an API key from logged text. */
function scrub(s: string): string {
  return s.replace(/sk-[A-Za-z0-9_\-*.]{2,}/g, "[key]").replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[key]");
}

async function callOpenAI(key: string, model: string, job: Job): Promise<Call> {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: job.instructions,
      input: [{ role: "user", content: [
        { type: "input_text", text: job.prompt },
        ...(job.image ? [{ type: "input_image", image_url: job.image.dataUrl, detail: "high" }] : []),
      ] }],
      text: { format: { type: "json_schema", name: "medicine_pack", strict: true, schema: OPENAI_SCHEMA } },
      store: false,
    }),
  });
  const data: any = await r.json().catch(() => null);
  let text: string | null = typeof data?.output_text === "string" ? data.output_text : null;
  for (const item of data?.output ?? []) for (const part of item?.content ?? []) if (!text && part?.type === "output_text") text = part.text;
  return { ok: r.ok, status: r.status, code: String(data?.error?.code ?? data?.error?.type ?? ""), message: String(data?.error?.message ?? ""), text };
}

async function callGemini(key: string, model: string, job: Job): Promise<Call> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: job.instructions }] },
      contents: [{ role: "user", parts: [
        { text: job.prompt },
        ...(job.image ? [{ inline_data: { mime_type: job.image.mime, data: job.image.base64 } }] : []),
      ] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA },
    }),
  });
  const data: any = await r.json().catch(() => null);
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("") || null;
  return { ok: r.ok && !!text, status: r.ok && !text ? 502 : r.status, code: String(data?.error?.status ?? (r.ok && !text ? data?.candidates?.[0]?.finishReason ?? "empty" : "")), message: String(data?.error?.message ?? ""), text };
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
