// Tests the /api/identify function with OpenAI's endpoint mocked. Run with: npm test
import assert from "node:assert/strict";
import handler from "../functions/identify";
delete process.env.GEMINI_API_KEY; delete process.env.VISION_PROVIDER;
import { toExtraction } from "../src/api/client";

type Captured = { url?: string; init?: any };
function mockRes() {
  const out: { code: number; body: any } = { code: 0, body: null };
  const res = { status(c: number) { out.code = c; return res; }, json(b: unknown) { out.body = b; }, setHeader() {} };
  return { res, out };
}
const IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓ " + name); };

(async () => {
  console.log("Vision function (/api/identify)");
  const realFetch = globalThis.fetch;

  await test("GET reports whether a key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const { res, out } = mockRes();
    await handler({ method: "GET" }, res);
    assert.deepEqual(out.body, { configured: false, provider: null });
  });

  await test("POST without a key returns not_configured", async () => {
    const { res, out } = mockRes();
    await handler({ method: "POST", body: { image: IMG } }, res);
    assert.equal(out.code, 503);
    assert.equal(out.body.error, "not_configured");
  });

  process.env.OPENAI_API_KEY = "sk-test";
  await test("rejects non-image payloads", async () => {
    const { res, out } = mockRes();
    await handler({ method: "POST", body: { image: "hello" } }, res);
    assert.equal(out.code, 400);
  });

  await test("sends image + strict JSON schema to the Responses API and returns parsed fields", async () => {
    const cap: Captured = {};
    const result = { is_medicine_pack: true, brand_name: { value: "Cetimac", read: "clear" }, active_ingredients: { value: "Cetirizine", read: "clear" }, strength: { value: "10 mg", read: "clear" }, dosage_form: { value: "Tablet", read: "clear" }, release_type: { value: null, read: "not_found" } };
    (globalThis as any).fetch = async (url: string, init: any) => {
      cap.url = url; cap.init = init;
      return { ok: true, status: 200, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] }) };
    };
    const { res, out } = mockRes();
    await handler({ method: "POST", body: { image: IMG } }, res);
    assert.equal(cap.url, "https://api.openai.com/v1/responses");
    const sent = JSON.parse(cap.init.body);
    assert.equal(cap.init.headers.Authorization, "Bearer sk-test");
    assert.equal(sent.input[0].content[1].type, "input_image");
    assert.equal(sent.input[0].content[1].image_url, IMG);
    assert.equal(sent.text.format.type, "json_schema");
    assert.equal(sent.text.format.strict, true);
    assert.equal(sent.store, false);
    assert.equal(out.code, 200);
    const ex = toExtraction(out.body.result);
    assert.equal(ex.brand_name.value, "Cetimac");
    assert.equal(ex.release_type.read, "not_found");
  });

  await test("upstream error becomes vision_failed (key never echoed)", async () => {
    (globalThis as any).fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { code: "invalid_api_key", message: "Incorrect API key provided: sk-test. You can find your API key at ..." } }) });
    const { res, out } = mockRes();
    const err = console.error; console.error = () => {};
    await handler({ method: "POST", body: { image: IMG } }, res);
    console.error = err;
    assert.equal(out.code, 502);
    assert.deepEqual(out.body, { error: "vision_failed" }); // no codes or messages reach the customer
    assert.ok(!JSON.stringify(out.body).includes("sk-test"));
  });

  await test("falls back to a second model when the first isn't available", async () => {
    const models: string[] = [];
    (globalThis as any).fetch = async (_u: string, init: any) => {
      const m = JSON.parse(init.body).model; models.push(m);
      if (models.length === 1) return { ok: false, status: 404, json: async () => ({ error: { code: "model_not_found", message: "no" } }) };
      return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ is_medicine_pack: false, brand_name: { value: null, read: "not_found" }, active_ingredients: { value: null, read: "not_found" }, strength: { value: null, read: "not_found" }, dosage_form: { value: null, read: "not_found" }, release_type: { value: null, read: "not_found" } }) }) };
    };
    const { res, out } = mockRes();
    const err = console.error; console.error = () => {};
    await handler({ method: "POST", body: { image: IMG } }, res);
    console.error = err;
    assert.equal(models.length, 2);
    assert.equal(out.code, 200);
    assert.equal(out.body.model, "gpt-4.1-mini");
  });

  await test("no credit: customer sees a generic failure, the reason is logged for the team", async () => {
    (globalThis as any).fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { code: "insufficient_quota", message: "You exceeded your current quota" } }) });
    const { res, out } = mockRes();
    const logs: string[] = []; const err = console.error; console.error = (m: string) => logs.push(m);
    await handler({ method: "POST", body: { image: IMG } }, res);
    console.error = err;
    assert.deepEqual(out.body, { error: "vision_failed" });
    assert.ok(logs.some((l) => l.includes("insufficient_quota")));
  });

  console.log("Gemini provider");
  process.env.GEMINI_API_KEY = "AIzaTestKey1234567890";

  await test("GET reports Gemini when its key is set (preferred over OpenAI)", async () => {
    const { res, out } = mockRes();
    await handler({ method: "GET" }, res);
    assert.deepEqual(out.body, { configured: true, provider: "gemini" });
  });

  await test("sends inline image + response schema to Gemini and parses the JSON", async () => {
    const cap: Captured = {};
    const result = { is_medicine_pack: true, brand_name: { value: "Cetimac", read: "clear" }, active_ingredients: { value: "Cetirizine", read: "clear" }, strength: { value: "10 mg", read: "clear" }, dosage_form: { value: "Tablet", read: "clear" }, release_type: { value: null, read: "not_found" } };
    (globalThis as any).fetch = async (url: string, init: any) => {
      cap.url = url; cap.init = init;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }) };
    };
    const { res, out } = mockRes();
    await handler({ method: "POST", body: { image: IMG } }, res);
    assert.ok(cap.url!.includes("generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"));
    assert.equal(cap.init.headers["x-goog-api-key"], "AIzaTestKey1234567890");
    const sent = JSON.parse(cap.init.body);
    assert.equal(sent.contents[0].parts[1].inline_data.mime_type, "image/jpeg");
    assert.equal(sent.contents[0].parts[1].inline_data.data, "/9j/4AAQSkZJRg==");
    assert.equal(sent.generationConfig.responseMimeType, "application/json");
    assert.equal(out.code, 200);
    assert.equal(out.body.provider, "gemini");
    assert.equal(toExtraction(out.body.result).brand_name.value, "Cetimac");
  });

  await test("Gemini free quota exhausted on one model: retries the lighter model", async () => {
    const urls: string[] = [];
    (globalThis as any).fetch = async (url: string) => {
      urls.push(url);
      if (urls.length === 1) return { ok: false, status: 429, json: async () => ({ error: { status: "RESOURCE_EXHAUSTED", message: "quota" } }) };
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"is_medicine_pack":false}' }] } }] }) };
    };
    const { res, out } = mockRes();
    const err = console.error; console.error = () => {};
    await handler({ method: "POST", body: { image: IMG } }, res);
    console.error = err;
    assert.ok(urls[1].includes("gemini-2.5-flash-lite"));
    assert.equal(out.code, 200);
  });

  await test("Gemini errors stay out of the response; key scrubbed from logs", async () => {
    (globalThis as any).fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { status: "INVALID_ARGUMENT", message: "API key not valid: AIzaTestKey1234567890" } }) });
    const { res, out } = mockRes();
    const logs: string[] = []; const err = console.error; console.error = (m: string) => logs.push(m);
    await handler({ method: "POST", body: { image: IMG } }, res);
    console.error = err;
    assert.deepEqual(out.body, { error: "vision_failed" });
    assert.ok(logs.length && !logs.join(" ").includes("AIzaTestKey"));
  });

  await test("VISION_PROVIDER=openai overrides Gemini", async () => {
    process.env.VISION_PROVIDER = "openai";
    const { res, out } = mockRes();
    await handler({ method: "GET" }, res);
    assert.equal(out.body.provider, "openai");
    delete process.env.VISION_PROVIDER;
  });

  globalThis.fetch = realFetch;
  console.log(`\n${passed} vision tests passed`);
})();
