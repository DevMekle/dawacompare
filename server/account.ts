// Accounts and the Plus subscription: phone + OTP login, signed sessions, family profiles,
// medicines saved to the account, refill reminders and price-drop alerts.
// Pure logic over a small Db interface so it runs the same on Neon and in tests (PGlite).

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { CatalogueStore } from "../src/catalogue/store";
import { comparisonWithStore, formulationComparisonWithStore } from "../src/catalogue/service";
import type { ComparableProduct } from "../src/domain/types";
import type { SmsSender } from "./sms";

export interface Db { query(text: string, params?: unknown[]): Promise<any[]> }
export interface Deps { db: Db; secret: string; sms: SmsSender | null; store: CatalogueStore; now?: () => Date }

export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SEC = 30;
export const SESSION_DAYS = 30;
export const PLUS_DAYS = 30;
export const LIMITS = { free: { profiles: 1 }, plus: { profiles: 6, saved: 50 } };

export class AccountError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

const nowOf = (d: Deps) => (d.now ? d.now() : new Date());

/** Indian mobile numbers only: "98765 43210", "+91 9876543210", "09876543210" → "+919876543210". */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let n = input.replace(/[\s\-()]/g, "");
  if (n.startsWith("+91")) n = n.slice(3);
  else if (n.startsWith("91") && n.length === 12) n = n.slice(2);
  else if (n.startsWith("0") && n.length === 11) n = n.slice(1);
  return /^[6-9]\d{9}$/.test(n) ? `+91${n}` : null;
}

const hashCode = (secret: string, phone: string, code: string) => createHash("sha256").update(`${secret}:${phone}:${code}`).digest("hex");

// ---- sessions: base64url(JSON {u, e}).hmac ----------------------------------------------
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function makeToken(secret: string, userId: number, now: Date): string {
  const body = b64(JSON.stringify({ u: userId, e: Math.floor(now.getTime() / 1000) + SESSION_DAYS * 86400 }));
  return `${body}.${sign(secret, body)}`;
}

export function readToken(secret: string, token: string | null | undefined, now: Date): number | null {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const want = sign(secret, body);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof p.u === "number" && p.e * 1000 > now.getTime() ? p.u : null;
  } catch {
    return null;
  }
}

// ---- OTP ---------------------------------------------------------------------------------
/** Sends a code. Without an SMS provider the code is returned (test mode) so the app can show it. */
export async function requestOtp(d: Deps, phoneInput: unknown): Promise<{ sent: true; test_code?: string }> {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new AccountError("bad_phone");
  const now = nowOf(d);
  const [prev] = await d.db.query("SELECT sent_at FROM otp_codes WHERE phone = $1", [phone]);
  if (prev && now.getTime() - new Date(prev.sent_at).getTime() < OTP_RESEND_SEC * 1000) throw new AccountError("too_soon", 429);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = new Date(now.getTime() + OTP_TTL_MIN * 60_000);
  await d.db.query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = EXCLUDED.sent_at`,
    [phone, hashCode(d.secret, phone, code), expires.toISOString(), now.toISOString()],
  );
  if (d.sms) {
    const ok = await d.sms.sendOtp(phone, code);
    if (!ok) throw new AccountError("sms_failed", 502);
    return { sent: true };
  }
  return { sent: true, test_code: code };
}

/** Checks the code; creates the account on first login (consent required). */
export async function verifyOtp(d: Deps, phoneInput: unknown, codeInput: unknown, consent: unknown): Promise<{ token: string; userId: number; created: boolean }> {
  const phone = normalizePhone(phoneInput);
  const code = typeof codeInput === "string" ? codeInput.trim() : "";
  if (!phone) throw new AccountError("bad_phone");
  if (!/^\d{6}$/.test(code)) throw new AccountError("bad_code");
  const now = nowOf(d);
  const [row] = await d.db.query("SELECT code_hash, expires_at, attempts FROM otp_codes WHERE phone = $1", [phone]);
  if (!row || new Date(row.expires_at).getTime() < now.getTime()) throw new AccountError("code_expired");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new AccountError("too_many_attempts", 429);
  if (row.code_hash !== hashCode(d.secret, phone, code)) {
    await d.db.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1", [phone]);
    throw new AccountError("wrong_code");
  }
  let [user] = await d.db.query("SELECT id FROM users WHERE phone = $1", [phone]);
  let created = false;
  if (!user) {
    if (consent !== true) throw new AccountError("consent_required");
    [user] = await d.db.query("INSERT INTO users (phone, consent_at, last_login_at) VALUES ($1, $2, $2) RETURNING id", [phone, now.toISOString()]);
    await d.db.query("INSERT INTO profiles (user_id, name) VALUES ($1, $2)", [user.id, "Me"]);
    created = true;
  } else {
    await d.db.query("UPDATE users SET last_login_at = $2 WHERE id = $1", [user.id, now.toISOString()]);
  }
  await d.db.query("DELETE FROM otp_codes WHERE phone = $1", [phone]);
  const id = Number(user.id);
  return { token: makeToken(d.secret, id, now), userId: id, created };
}

// ---- account -----------------------------------------------------------------------------
export interface Me {
  phone: string;
  plan: "free" | "plus";
  plan_until: string | null;
  profiles: { id: number; name: string }[];
  limits: { profiles: number };
}

async function userRow(d: Deps, uid: number) {
  const [u] = await d.db.query("SELECT id, phone, plan, plan_until FROM users WHERE id = $1", [uid]);
  if (!u) throw new AccountError("not_signed_in", 401);
  return u;
}

const isPlus = (u: any, now: Date) => u.plan === "plus" && u.plan_until && new Date(u.plan_until).getTime() > now.getTime();

export async function getMe(d: Deps, uid: number): Promise<Me> {
  const u = await userRow(d, uid);
  const plus = isPlus(u, nowOf(d));
  const profiles = await d.db.query("SELECT id, name FROM profiles WHERE user_id = $1 ORDER BY id", [uid]);
  return {
    phone: u.phone,
    plan: plus ? "plus" : "free",
    plan_until: plus ? new Date(u.plan_until).toISOString() : null,
    profiles: profiles.map((p: any) => ({ id: Number(p.id), name: p.name })),
    limits: { profiles: plus ? LIMITS.plus.profiles : LIMITS.free.profiles },
  };
}

async function requirePlus(d: Deps, uid: number) {
  const u = await userRow(d, uid);
  if (!isPlus(u, nowOf(d))) throw new AccountError("plus_required", 402);
}

/** Test-mode checkout: no money is charged. Extends an active Plus period by 30 days. */
export async function subscribe(d: Deps, uid: number): Promise<Me> {
  const u = await userRow(d, uid);
  const now = nowOf(d);
  const from = isPlus(u, now) ? new Date(u.plan_until) : now;
  const until = new Date(from.getTime() + PLUS_DAYS * 86400_000);
  await d.db.query("UPDATE users SET plan = 'plus', plan_until = $2 WHERE id = $1", [uid, until.toISOString()]);
  return getMe(d, uid);
}

export async function cancel(d: Deps, uid: number): Promise<Me> {
  await userRow(d, uid);
  await d.db.query("UPDATE users SET plan = 'free', plan_until = NULL WHERE id = $1", [uid]);
  return getMe(d, uid);
}

export async function deleteAccount(d: Deps, uid: number): Promise<void> {
  await d.db.query("DELETE FROM users WHERE id = $1", [uid]);
}

// ---- profiles (Plus: up to 6) ------------------------------------------------------------
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 40) : "");

export async function addProfile(d: Deps, uid: number, nameIn: unknown): Promise<Me> {
  const name = cleanName(nameIn);
  if (!name) throw new AccountError("bad_name");
  const me = await getMe(d, uid);
  if (me.plan !== "plus") throw new AccountError("plus_required", 402);
  if (me.profiles.length >= me.limits.profiles) throw new AccountError("profile_limit");
  await d.db.query("INSERT INTO profiles (user_id, name) VALUES ($1, $2)", [uid, name]);
  return getMe(d, uid);
}

export async function renameProfile(d: Deps, uid: number, id: unknown, nameIn: unknown): Promise<Me> {
  const name = cleanName(nameIn);
  if (!name) throw new AccountError("bad_name");
  await d.db.query("UPDATE profiles SET name = $3 WHERE id = $1 AND user_id = $2", [Number(id), uid, name]);
  return getMe(d, uid);
}

export async function removeProfile(d: Deps, uid: number, id: unknown): Promise<Me> {
  const me = await getMe(d, uid);
  if (me.profiles.length <= 1) throw new AccountError("last_profile");
  await d.db.query("DELETE FROM profiles WHERE id = $1 AND user_id = $2", [Number(id), uid]);
  return getMe(d, uid);
}

// ---- saved medicines (Plus) --------------------------------------------------------------
export interface SavedRow {
  id: number;
  profile_id: number;
  key: string;
  data: any;
  best_unit_price: number | null;
  refill_every_days: number | null;
  next_refill: string | null;
}

const toSaved = (r: any): SavedRow => ({
  id: Number(r.id), profile_id: Number(r.profile_id), key: r.key, data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
  best_unit_price: r.best_unit_price == null ? null : Number(r.best_unit_price),
  refill_every_days: r.refill_every_days == null ? null : Number(r.refill_every_days),
  next_refill: r.next_refill == null ? null : typeof r.next_refill === "string" ? r.next_refill.slice(0, 10) : new Date(r.next_refill).toISOString().slice(0, 10),
});

const SAVED_COLS = "id, profile_id, key, data, best_unit_price, refill_every_days, to_char(next_refill, 'YYYY-MM-DD') AS next_refill";

export async function listSaved(d: Deps, uid: number): Promise<SavedRow[]> {
  await requirePlus(d, uid);
  return (await d.db.query(`SELECT ${SAVED_COLS} FROM saved_medicines WHERE user_id = $1 ORDER BY created_at DESC`, [uid])).map(toSaved);
}

export async function saveMedicine(d: Deps, uid: number, b: any): Promise<SavedRow[]> {
  await requirePlus(d, uid);
  const profileId = Number(b?.profile_id);
  const [prof] = await d.db.query("SELECT id FROM profiles WHERE id = $1 AND user_id = $2", [profileId, uid]);
  if (!prof) throw new AccountError("bad_profile");
  const key = typeof b?.key === "string" ? b.key.slice(0, 200) : "";
  const data = b?.data && typeof b.data === "object" ? JSON.stringify(b.data) : null;
  if (!key || !data || data.length > 8000) throw new AccountError("bad_request");
  const [{ n }] = await d.db.query("SELECT count(*)::int AS n FROM saved_medicines WHERE user_id = $1", [uid]);
  if (n >= LIMITS.plus.saved) throw new AccountError("saved_limit");
  const best = Number.isFinite(Number(b?.best_unit_price)) && Number(b.best_unit_price) > 0 ? Number(b.best_unit_price) : null;
  await d.db.query(
    `INSERT INTO saved_medicines (user_id, profile_id, key, data, best_unit_price) VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (profile_id, key) DO UPDATE SET data = EXCLUDED.data, best_unit_price = EXCLUDED.best_unit_price`,
    [uid, profileId, key, data, best],
  );
  return listSaved(d, uid);
}

export async function removeSaved(d: Deps, uid: number, id: unknown): Promise<SavedRow[]> {
  await requirePlus(d, uid);
  await d.db.query("DELETE FROM saved_medicines WHERE id = $1 AND user_id = $2", [Number(id), uid]);
  return listSaved(d, uid);
}

/** Refill reminder: every N days (7–180) from a next-refill date; null turns it off. */
export async function setReminder(d: Deps, uid: number, id: unknown, every: unknown, next: unknown): Promise<SavedRow[]> {
  await requirePlus(d, uid);
  if (every == null) {
    await d.db.query("UPDATE saved_medicines SET refill_every_days = NULL, next_refill = NULL, reminded_for = NULL WHERE id = $1 AND user_id = $2", [Number(id), uid]);
    return listSaved(d, uid);
  }
  const days = Number(every);
  const date = typeof next === "string" && /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : null;
  if (!Number.isInteger(days) || days < 7 || days > 180 || !date) throw new AccountError("bad_reminder");
  await d.db.query("UPDATE saved_medicines SET refill_every_days = $3, next_refill = $4::date, reminded_for = NULL WHERE id = $1 AND user_id = $2", [Number(id), uid, days, date]);
  return listSaved(d, uid);
}

// ---- alerts: price drops and refills due -------------------------------------------------
export interface Alert {
  kind: "price_drop" | "refill_due";
  saved_id: number;
  profile_id: number;
  medicine: string;
  /** price_drop: the cheaper option and its per-tablet price now, against the cheapest when saved. */
  option?: string;
  unit_now?: number;
  unit_before?: number;
  /** refill_due: the refill date. */
  date?: string;
}

const cheapestNow = (alts: ComparableProduct[]) =>
  alts.filter((a) => a.mrp?.freshness === "current" && a.mrp.per_unit != null).sort((a, b) => a.mrp!.per_unit! - b.mrp!.per_unit!)[0] ?? null;

export async function alerts(d: Deps, uid: number): Promise<Alert[]> {
  const saved = await listSaved(d, uid);
  const now = nowOf(d);
  const soon = new Date(now.getTime() + 3 * 86400_000).toISOString().slice(0, 10);
  const out: Alert[] = [];
  for (const s of saved) {
    const name = String(s.data?.brand ?? "");
    if (s.next_refill && s.next_refill <= soon) out.push({ kind: "refill_due", saved_id: s.id, profile_id: s.profile_id, medicine: name, date: s.next_refill });
    if (s.best_unit_price == null) continue;
    try {
      const alts = s.data?.kind === "pack" && s.data.formulation
        ? (await formulationComparisonWithStore(d.store, s.data.formulation)).alternatives
        : s.data?.record?.medicine_id ? (await comparisonWithStore(d.store, s.data.record.medicine_id)).alternatives : [];
      const best = cheapestNow(alts);
      if (best && best.mrp!.per_unit! < s.best_unit_price - 0.005) {
        out.push({ kind: "price_drop", saved_id: s.id, profile_id: s.profile_id, medicine: name, option: best.brand_name, unit_now: Math.round(best.mrp!.per_unit! * 100) / 100, unit_before: s.best_unit_price });
      }
    } catch { /* a medicine no longer in the catalogue simply gets no alert */ }
  }
  return out;
}

/** Daily job: SMS a reminder the day before a refill (when SMS is set up), then move past refills forward. */
export async function runReminders(d: Deps): Promise<{ reminded: number; advanced: number }> {
  const now = nowOf(d);
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);
  const due = await d.db.query(
    `SELECT s.id, s.data, to_char(s.next_refill, 'YYYY-MM-DD') AS next_refill, u.phone, p.name AS profile
       FROM saved_medicines s JOIN users u ON u.id = s.user_id JOIN profiles p ON p.id = s.profile_id
      WHERE s.next_refill IS NOT NULL AND s.next_refill <= $1::date AND s.next_refill >= $2::date
        AND (s.reminded_for IS NULL OR s.reminded_for < s.next_refill)
        AND u.plan = 'plus' AND u.plan_until > $3`,
    [tomorrow, today, now.toISOString()],
  );
  let reminded = 0;
  for (const r of due) {
    const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    const ok = d.sms ? await d.sms.sendText(r.phone, `DawaCompare: refill of ${data?.brand ?? "a saved medicine"} for ${r.profile} is due on ${r.next_refill}. Check today's prices before you buy.`) : false;
    await d.db.query("UPDATE saved_medicines SET reminded_for = next_refill WHERE id = $1", [r.id]);
    if (ok) reminded++;
  }
  const moved = await d.db.query(
    `UPDATE saved_medicines SET next_refill = next_refill + refill_every_days, reminded_for = NULL
      WHERE next_refill IS NOT NULL AND refill_every_days IS NOT NULL AND next_refill < $1::date RETURNING id`,
    [today],
  );
  return { reminded, advanced: moved.length };
}
