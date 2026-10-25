// Accounts and Plus, against a real PostgreSQL engine (PGlite) with db/schema.sql + db/seed.sql.
// Run with: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import * as A from "../server/account";
import { createSeedStore } from "../src/catalogue/store";
import type { SmsSender } from "../server/sms";
import { smsFromEnv } from "../server/sms";

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + name); };
const rejects = async (p: Promise<unknown>, code: string) => { await assert.rejects(p, (e: any) => e instanceof A.AccountError && e.code === code); };

(async () => {
  console.log("Accounts and Plus (PGlite)");
  const pg = new PGlite();
  await pg.exec("SET TIME ZONE 'UTC';");
  await pg.exec(readFileSync("db/schema.sql", "utf8"));
  await pg.exec(readFileSync("db/seed.sql", "utf8"));
  let clock = new Date("2026-10-25T10:00:00Z");
  const advance = (sec: number) => { clock = new Date(clock.getTime() + sec * 1000); };
  const db: A.Db = { query: async (t, p) => (await pg.query(t, (p ?? []) as any[])).rows as any[] };
  const deps: A.Deps = { db, secret: "test-secret-0123456789-abcdef", sms: null, store: createSeedStore(() => clock, "real"), now: () => clock };
  const PHONE = "98765 43210";

  await test("phone numbers: Indian mobiles only, normalised to +91", async () => {
    assert.equal(A.normalizePhone("98765 43210"), "+919876543210");
    assert.equal(A.normalizePhone("+91-98765-43210"), "+919876543210");
    assert.equal(A.normalizePhone("098765 43210"), "+919876543210");
    for (const bad of ["12345", "5876543210", "+14155550123", "", null]) assert.equal(A.normalizePhone(bad), null);
  });

  let code = "";
  await test("test mode (no SMS provider): code returned for display; only its hash is stored", async () => {
    const r = await A.requestOtp(deps, PHONE);
    assert.match(r.test_code!, /^\d{6}$/);
    code = r.test_code!;
    const [row] = await db.query("SELECT code_hash FROM otp_codes WHERE phone = '+919876543210'");
    assert.ok(row.code_hash.length === 64 && !row.code_hash.includes(code));
    await rejects(A.requestOtp(deps, PHONE), "too_soon");
  });

  await test("with an SMS provider the code is sent, never returned", async () => {
    const sent: string[] = [];
    const sms: SmsSender = { name: "fake", sendOtp: async (_p, c) => { sent.push(c); return true; }, sendText: async () => true };
    const r = await A.requestOtp({ ...deps, sms }, "9123456780");
    assert.equal(r.test_code, undefined);
    assert.equal(sent.length, 1);
  });

  let uid = 0;
  await test("first login needs consent; wrong codes are counted; the right code signs in", async () => {
    await rejects(A.verifyOtp(deps, PHONE, "000000" === code ? "111111" : "000000", true), "wrong_code");
    await rejects(A.verifyOtp(deps, PHONE, code, false), "consent_required");
    const r = await A.verifyOtp(deps, PHONE, code, true);
    assert.ok(r.created && r.token.includes("."));
    uid = r.userId;
    assert.equal(A.readToken(deps.secret, r.token, clock), uid);
    assert.equal(A.readToken(deps.secret, r.token.slice(0, -2) + "xx", clock), null);
    assert.equal(A.readToken("another-secret-0123456789", r.token, clock), null);
    await rejects(A.verifyOtp(deps, PHONE, code, true), "code_expired"); // single use
  });

  await test("codes expire and lock after 5 wrong tries", async () => {
    advance(31);
    const c = (await A.requestOtp(deps, PHONE)).test_code!;
    for (let i = 0; i < 5; i++) await rejects(A.verifyOtp(deps, PHONE, c === "123456" ? "654321" : "123456", true), "wrong_code");
    await rejects(A.verifyOtp(deps, PHONE, c, true), "too_many_attempts");
    advance(31);
    const c2 = (await A.requestOtp(deps, PHONE)).test_code!;
    advance(11 * 60);
    await rejects(A.verifyOtp(deps, PHONE, c2, true), "code_expired");
  });

  await test("free plan: one profile, no Plus features", async () => {
    const me = await A.getMe(deps, uid);
    assert.equal(me.plan, "free");
    assert.deepEqual(me.profiles.map((p) => p.name), ["Me"]);
    await rejects(A.addProfile(deps, uid, "Papa"), "plus_required");
    await rejects(A.listSaved(deps, uid), "plus_required");
  });

  let pid = 0;
  await test("Plus (test-mode checkout): 30 days, family profiles up to 6", async () => {
    const me = await A.subscribe(deps, uid);
    assert.equal(me.plan, "plus");
    assert.equal(new Date(me.plan_until!).getTime() - clock.getTime(), 30 * 86400_000);
    const me2 = await A.addProfile(deps, uid, "  Papa  ");
    pid = me2.profiles.find((p) => p.name === "Papa")!.id;
    for (let i = 0; i < 4; i++) await A.addProfile(deps, uid, `P${i}`);
    await rejects(A.addProfile(deps, uid, "Seventh"), "profile_limit");
  });

  await test("saved medicines sync to the account; price-drop alert when a cheaper option appears", async () => {
    const record = { medicine_id: "real_telma_40" };
    // Saved when the cheapest option seen was ₹6.19 (Telmikind 40); the catalogue now has Jan Aushadhi at ₹1.24.
    const saved = await A.saveMedicine(deps, uid, { profile_id: pid, key: "real_telma_40", data: { kind: "catalogue", brand: "Telma 40", record }, best_unit_price: 6.19 });
    assert.equal(saved.length, 1);
    const al = await A.alerts(deps, uid);
    const drop = al.find((a) => a.kind === "price_drop")!;
    assert.equal(drop.option, "Jan Aushadhi Telmisartan Tablets IP 40 mg");
    assert.equal(drop.unit_now, 1.24);
    // Saved at today's cheapest: no alert.
    await A.saveMedicine(deps, uid, { profile_id: pid, key: "real_telma_40", data: { kind: "catalogue", brand: "Telma 40", record }, best_unit_price: 1.238 });
    assert.equal((await A.alerts(deps, uid)).filter((a) => a.kind === "price_drop").length, 0);
    await rejects(A.saveMedicine(deps, uid, { profile_id: 999999, key: "x", data: { brand: "x" } }), "bad_profile");
  });

  await test("refill reminders: due soon shows in-app; daily job texts the day before, then moves the date on", async () => {
    const [s] = await A.listSaved(deps, uid);
    await rejects(A.setReminder(deps, uid, s.id, 3, "2026-10-26"), "bad_reminder");
    await A.setReminder(deps, uid, s.id, 30, "2026-10-26");
    assert.ok((await A.alerts(deps, uid)).some((a) => a.kind === "refill_due" && a.date === "2026-10-26"));
    const texts: string[] = [];
    const sms: SmsSender = { name: "fake", sendOtp: async () => true, sendText: async (_p, t) => { texts.push(t); return true; } };
    assert.deepEqual(await A.runReminders({ ...deps, sms }), { reminded: 1, advanced: 0 });
    assert.match(texts[0], /Telma 40 for Papa is due on 2026-10-26/);
    assert.deepEqual(await A.runReminders({ ...deps, sms }), { reminded: 0, advanced: 0 }); // not twice
    advance(2 * 86400);
    const r = await A.runReminders({ ...deps, sms });
    assert.equal(r.advanced, 1);
    assert.equal((await A.listSaved(deps, uid))[0].next_refill, "2026-11-25");
  });

  await test("Plus ends: features lock again; delete account removes everything", async () => {
    await A.cancel(deps, uid);
    await rejects(A.listSaved(deps, uid), "plus_required");
    await A.deleteAccount(deps, uid);
    await rejects(A.getMe(deps, uid), "not_signed_in");
    for (const t of ["profiles", "saved_medicines"]) assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${t === "profiles" ? "user_id" : "user_id"} = $1`, [uid]))[0].n, 0);
  });

  await test("SMS provider is picked from environment variables", async () => {
    assert.equal(smsFromEnv({}), null);
    assert.equal(smsFromEnv({ SMS_PROVIDER: "msg91", MSG91_AUTHKEY: "k" }), null); // template id missing
    assert.equal(smsFromEnv({ SMS_PROVIDER: "msg91", MSG91_AUTHKEY: "k", MSG91_OTP_TEMPLATE_ID: "t" })?.name, "msg91");
    assert.equal(smsFromEnv({ SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "a", TWILIO_AUTH_TOKEN: "b", TWILIO_FROM: "+1" })?.name, "twilio");
  });

  console.log(`\n${passed} account tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
