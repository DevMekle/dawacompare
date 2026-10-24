// Vercel serverless function: /api/feedback
//   POST { kind: "feedback", helpful, comment?, medicine_name?, alternative_name?, monthly_saving?, lang? }
//   POST { kind: "event", name, meta? }        name: comparison_viewed | savings_viewed | summary_ready | shared_whatsapp | saved_medicine
//   GET  ?action=stats                          → { checks } (number of comparisons viewed), public aggregate only
// Stores anonymous rows in PostgreSQL (DATABASE_URL). Nothing personal is collected.

import { neon } from "@neondatabase/serverless";

type Req = { method?: string; url?: string; body?: any };
type Res = { status: (code: number) => Res; json: (body: unknown) => void; setHeader: (k: string, v: string) => void };

const EVENTS = ["comparison_viewed", "savings_viewed", "summary_ready", "shared_whatsapp", "saved_medicine"];
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return res.status(503).json({ error: "not_configured" });
  const sql = neon(url);
  try {
    if (req.method === "GET") {
      const action = new URL(req.url ?? "/", "http://localhost").searchParams.get("action");
      if (action !== "stats") return res.status(400).json({ error: "unknown_action" });
      const rows: any[] = await sql("SELECT count(*)::int AS n FROM events WHERE name = 'comparison_viewed'", []);
      return res.status(200).json({ checks: rows[0]?.n ?? 0 });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (b.kind === "feedback") {
      const helpful = typeof b.helpful === "boolean" ? b.helpful : null;
      const saving = Number.isFinite(Number(b.monthly_saving)) ? Number(b.monthly_saving) : null;
      await sql(
        "INSERT INTO feedback (helpful, comment, medicine_name, alternative_name, monthly_saving, lang) VALUES ($1, $2, $3, $4, $5, $6)",
        [helpful, str(b.comment, 1000), str(b.medicine_name, 120), str(b.alternative_name, 160), saving, str(b.lang, 5)],
      );
      return res.status(200).json({ ok: true });
    }
    if (b.kind === "event" && EVENTS.includes(b.name)) {
      const meta = b.meta && typeof b.meta === "object" ? JSON.stringify(b.meta).slice(0, 2000) : null;
      await sql("INSERT INTO events (name, meta) VALUES ($1, $2::jsonb)", [b.name, meta]);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "bad_request" });
  } catch (e) {
    console.error("feedback error", e);
    return res.status(500).json({ error: "feedback_error" });
  }
}
