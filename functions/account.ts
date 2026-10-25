// Vercel serverless function: /api/account
//   GET  ?action=me                         → { user } or 401
//   GET  ?action=saved | alerts             → Plus only
//   GET  ?action=cron                       → daily refill reminders (Vercel Cron; Authorization: Bearer CRON_SECRET)
//   POST { action: "request_otp", phone }   → { sent, test_code? }   test_code only when no SMS provider is set up
//   POST { action: "verify_otp", phone, code, consent } → sets the session cookie, { user }
//   POST { action: "logout" | "delete_account" | "subscribe" | "cancel" }
//   POST { action: "add_profile", name } | { action: "rename_profile", id, name } | { action: "remove_profile", id }
//   POST { action: "save", profile_id, key, data, best_unit_price } | { action: "unsave", id }
//   POST { action: "reminder", id, every_days, next_refill }
// Needs DATABASE_URL and SESSION_SECRET (a long random string). The session is an HttpOnly cookie.

import { neon } from "@neondatabase/serverless";
import { getStore } from "../server/getStore";
import { smsFromEnv } from "../server/sms";
import * as A from "../server/account";

type Req = { method?: string; url?: string; body?: any; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (body: unknown) => void; setHeader: (k: string, v: string | string[]) => void };

const COOKIE = "dc_session";

function cookieValue(req: Req, name: string): string | null {
  const raw = req.headers?.cookie;
  const s = Array.isArray(raw) ? raw.join(";") : raw ?? "";
  for (const part of s.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

const setSession = (res: Res, token: string | null) =>
  res.setHeader("Set-Cookie", token
    ? `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${A.SESSION_DAYS * 86400}`
    : `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const secret = process.env.SESSION_SECRET;
  if (!url || !secret || secret.length < 24) return res.status(503).json({ error: "not_configured" });
  const sql = neon(url);
  return handle(req, res, { db: { query: (t, p) => sql(t, (p ?? []) as any[]) as Promise<any[]> }, secret, sms: smsFromEnv(), store: getStore() });
}

/** The routes, given a database, secret and SMS sender (also used by the local test server). */
export async function handle(req: Req, res: Res, deps: A.Deps) {
  const secret = deps.secret;
  const now = deps.now ? deps.now() : new Date();
  const uid = () => {
    const id = A.readToken(secret, cookieValue(req, COOKIE), now);
    if (id == null) throw new A.AccountError("not_signed_in", 401);
    return id;
  };

  try {
    if (req.method === "GET") {
      const action = new URL(req.url ?? "/", "http://localhost").searchParams.get("action");
      if (action === "cron") {
        const auth = req.headers?.authorization;
        if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "unauthorised" });
        return res.status(200).json(await A.runReminders(deps));
      }
      if (action === "me") return res.status(200).json({ user: await A.getMe(deps, uid()), sms: !!deps.sms });
      if (action === "saved") return res.status(200).json({ saved: await A.listSaved(deps, uid()) });
      if (action === "alerts") return res.status(200).json({ alerts: await A.alerts(deps, uid()) });
      return res.status(400).json({ error: "unknown_action" });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    switch (b.action) {
      case "request_otp": return res.status(200).json(await A.requestOtp(deps, b.phone));
      case "verify_otp": {
        const r = await A.verifyOtp(deps, b.phone, b.code, b.consent);
        setSession(res, r.token);
        return res.status(200).json({ user: await A.getMe(deps, r.userId), created: r.created });
      }
      case "logout": setSession(res, null); return res.status(200).json({ ok: true });
      case "delete_account": await A.deleteAccount(deps, uid()); setSession(res, null); return res.status(200).json({ ok: true });
      case "subscribe": return res.status(200).json({ user: await A.subscribe(deps, uid()), test_mode: true });
      case "cancel": return res.status(200).json({ user: await A.cancel(deps, uid()) });
      case "add_profile": return res.status(200).json({ user: await A.addProfile(deps, uid(), b.name) });
      case "rename_profile": return res.status(200).json({ user: await A.renameProfile(deps, uid(), b.id, b.name) });
      case "remove_profile": return res.status(200).json({ user: await A.removeProfile(deps, uid(), b.id) });
      case "save": return res.status(200).json({ saved: await A.saveMedicine(deps, uid(), b) });
      case "unsave": return res.status(200).json({ saved: await A.removeSaved(deps, uid(), b.id) });
      case "reminder": return res.status(200).json({ saved: await A.setReminder(deps, uid(), b.id, b.every_days, b.next_refill) });
      default: return res.status(400).json({ error: "unknown_action" });
    }
  } catch (e: any) {
    if (e instanceof A.AccountError) {
      if (e.status === 401) setSession(res, null);
      return res.status(e.status).json({ error: e.code });
    }
    console.error("account error", e?.message ?? e);
    return res.status(500).json({ error: "account_error" });
  }
}
