# DawaCompare — interactive prototype

A mobile-first React + TypeScript prototype for Indian households that buy the same prescription medicines every month. A user photographs a medicine strip, confirms what it is, sees reviewed alternatives with the same formulation, and gets a savings estimate to discuss with their doctor or pharmacist.

The catalogue lives in a **PostgreSQL database** (101 products across 25 common medicines, 136 price records). Salts, strengths and release types are real; **brand names, manufacturers, prices and review statuses are fictional sample data**. Photo reading uses the **real OpenAI Vision API** when the app is deployed on Vercel with an `OPENAI_API_KEY`; everywhere else it falls back to manual name entry or a clearly labelled simulated reading.

## Run it

You need Node.js 18 or newer.

```
npm install
npm run build      # writes dist/index.html
npm test           # 17 domain + 5 vision-function + 7 database tests (real Postgres via PGlite)
npm run db:sql     # regenerate db/seed.sql from src/data/seed.ts
npm run db:setup   # create tables + load the sample data into DATABASE_URL
npm run typecheck
```

Open `dist/index.html` in a browser. It loads React and the fonts from public CDNs, so keep the internet on.

**Deploy on Vercel:** import the GitHub repo. `vercel.json` already sets the build command (`npm run build`) and the output folder (`dist`).

## What is simulated and what is real

| Part of the planned system | In this prototype |
|---|---|
| Photo upload, camera capture, preview, replace | **Works.** The photo stays in the browser and is never uploaded or read. |
| OpenAI Vision extraction | **Implemented** in `functions/identify.ts` (Vercel function → OpenAI Responses API, strict JSON schema). Active only on a deployment with `OPENAI_API_KEY`. Without it, uploads go to manual entry; sample packs and the presenter option use simulated readings (`src/mock/scenarios.ts`). |
| Medicine catalogue (PostgreSQL) | **Implemented.** `db/schema.sql` + `db/seed.sql`, served by `functions/catalogue.ts` through `server/sqlStore.ts` when `DATABASE_URL` is set. Without a database the API (and the page itself) use the same rows from `src/data/seed.ts`. |
| Verification Layer | **Implemented** as real logic (`src/domain/verification.ts`), run against the mock catalogue. |
| Eligibility filtering (approved review, exact formulation) | **Implemented** (`src/domain/eligibility.ts`). |
| Price database | **Implemented** as the `price_records` table (type, pack quantity, source, verification status, last-verified date). The rows are fictional samples. |
| Admin price-update workflow | **Not built.** No connection to NPPA, manufacturers or pharmacies. Update rows with SQL or extend `src/data/seed.ts` and reload. |
| Per-unit, monthly and annual savings | **Implemented** (`src/domain/pricing.ts`). |
| Summary download, print and copy | **Works.** The summary downloads as a printable HTML file; Print shows when the page is opened directly or on Vercel. |
| English / Hindi | **Works** for all interface text and safety messages. Catalogue values stay as recorded. |

## Set up the database (Neon Postgres through Vercel, free tier)

1. In Vercel: **Project → Storage → Create Database → Neon (Postgres)**, pick the free plan and connect it to the project. Vercel adds `DATABASE_URL` to the project's environment variables.
2. Load the tables and sample data, either way:
   - **Neon SQL editor (no tools needed):** open the database in Neon's console → SQL Editor, paste all of `db/schema.sql`, run it, then paste all of `db/seed.sql` and run it.
   - **From your computer:** `npx vercel link`, `npx vercel env pull .env.local`, then `npm run db:setup`.
3. Redeploy. On the Compare screen the line under the sample-data note changes to "From the DawaCompare database · 101 products".

Any Postgres 14+ works (Supabase, RDS, local): set `DATABASE_URL` to its connection string. The app talks to it only through `functions/catalogue.ts`.

### What's in the sample catalogue

25 formulation groups, 4 fictional brands each (plus the demo groups): paracetamol 500/650 mg, atorvastatin 10/20 mg, rosuvastatin 10 mg, pantoprazole 40 mg (DR), omeprazole 20 mg capsule (DR), metformin 500 mg SR / 500 mg / 1000 mg SR, metformin + glimepiride, glimepiride 1/2 mg, losartan 50 mg, metoprolol succinate 50 mg (ER), amlodipine 5/10 mg, telmisartan 40 mg, telmisartan + amlodipine, telmisartan + HCTZ, cetirizine 10 mg, levocetirizine 5 mg, montelukast + levocetirizine, azithromycin 500 mg, amoxicillin + clavulanic acid 625, aspirin 75 mg (DR), clopidogrel 75 mg, ibuprofen 400 mg, levothyroxine 50 mcg.

Each group mixes the states the app must handle: verified MRP and selling price, MRP only, stale (over 90 days), unverified, and review pending. Levothyroxine alternatives are deliberately not approved because brand changes for narrow-therapeutic-index drugs need clinical oversight.

### Adding real data later

Insert into `medicines` and `price_records`. Two helper columns must be filled the same way the app normalises text: `brand_family` (lower-case first word of the brand) and `ingredients_norm` (lower-case canonical salt names, sorted, e.g. `{amoxicillin,clavulanic acid}`). The simplest route is to add rows to `src/data/seed.ts` (or a similar generator), run `npm run db:sql`, and load the result.

## Turn on live photo reading

### Free option: Google Gemini
1. Go to aistudio.google.com, sign in with a Google account, click **Get API key → Create API key**. No card needed for the free tier.
2. In Vercel → **Settings → Environment Variables**, add `GEMINI_API_KEY` (optional `GEMINI_MODEL`, default `gemini-2.5-flash`, falls back to `gemini-2.5-flash-lite` when the free quota runs out).
3. Redeploy. Gemini is used whenever its key is set; set `VISION_PROVIDER=openai` to force OpenAI.

Free-tier limits are per minute and per day, and Google states free-tier content may be used to improve its products. A pack photo contains printed packaging text only, but use a billed key if that matters.

### Paid option: OpenAI Vision

1. Get an API key at platform.openai.com → API keys. Usage is billed per request.
2. In Vercel: **Project → Settings → Environment Variables**, add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-5.4-mini`).
3. Redeploy. The upload screen now says "Live reading is on".

How it works: the browser shrinks the photo to at most 1600 px (JPEG) and posts it to `/api/identify`. The function sends it to OpenAI with `store: false`, asks only for what is printed (brand, salt, strength, form, release marking, plus how clearly each was read) and returns that JSON. The key never reaches the browser and the photo is not saved. The reading then goes through the same Verification Layer as everything else, so a real medicine that isn't in the sample catalogue is shown as "Not in catalogue" and blocked.

Test locally with the API: `npm i -g vercel`, then `vercel env pull` and `vercel dev`. Opening `dist/index.html` directly has no `/api`, so it uses the fallback.

## Safety rules enforced in code

- A critical field (salt, strength, dosage form, release type) that contradicts the catalogue blocks the comparison (`unable`). No button can override this; only a corrected reading that passes verification again can proceed.
- Missing or unclear fields require the user to choose the matching catalogue entry and tick that they checked the pack (`needs_confirmation`).
- After confirmation, every comparison uses the **catalogue record**, never the text read from the photo.
- Only alternatives with `review_status: "approved"`, a verified catalogue record and the exact same ingredients, strength, form and release type are returned. Everything else is counted by reason and never listed.
- Prices that are unverified, or older than 90 days, are flagged and never used for savings. Savings are only shown when both products have a current, verified price **of the same type** (MRP with MRP, selling price with selling price).
- The quantity input is a cost calculator only. No dose is inferred or suggested.

## Demo scenarios

| Scenario | How to see it | What happens |
|---|---|---|
| Fully matched | Sample pack "Clear pack" | Glucora SR 500 matches; 4 reviewed alternatives |
| Ambiguous release type | Sample pack "Torn label" | User must choose Glucora SR 500 or Glucora 500 |
| Strength mismatch | Sample pack "Smudged print" | Read 80 mg vs catalogue 40 mg: blocked. Correcting it to 40 mg re-verifies, then shows the "no reviewed alternative" empty state |
| Unreadable photo | Upload any photo, choose "Unreadable photo" | Blocked, with Retake and Manual entry options |
| Current price not verified | Search "Amlocard" manually | Savings blocked, with an explanation |
| Verified alternative price | Choose Metsave SR 500 | ₹4.00 vs ₹2.00 per tablet → ₹60 a month and ₹720 a year at 1 tablet a day |
| Stale price | Choose Metaveda SR 500 | Last verified over 90 days ago: no savings shown |
| No verified price | Choose Duometa SR 500 | Price on file is unverified: not shown or used |

## API

The UI only talks to `src/api/client.ts`. On a deployment it calls these endpoints; in a file preview or the Claude artifact it runs the same use-cases on the bundled catalogue:

| Method | Planned endpoint |
|---|---|
| `identifyWithVision` | `POST /api/identify` (**built**, see `functions/identify.ts`) |
| `identifyFromPhoto` | simulated readings for demos |
| `verify`, `searchCatalogue`, `getComparison` | `/api/catalogue` (**built**, PostgreSQL or bundled seed) |
| `verify` | `POST /api/verify` (Verification Layer) |
| `searchCatalogue` | `GET /api/medicines?q=` |
| `getComparison` | `GET /api/medicines/:id/comparison` |

The domain functions in `src/domain/` are pure and can move to the server unchanged.

## Project structure

```
functions/identify.ts    serverless function source: photo → OpenAI Vision → printed fields
functions/catalogue.ts   serverless function source: search, verify, comparison from the database
api/*.js                 the same functions bundled by `npm run build:api` (generated; Vercel runs these)
server/                  PostgreSQL store (Neon driver) and store selection
db/schema.sql, seed.sql  database tables and sample data
scripts/                 seed.sql generator and db:setup loader
src/data/seed.ts         the sample catalogue (single source of truth)
src/catalogue/           store interface, in-memory store, shared use-cases
src/
  api/client.ts          the data interface the UI calls (mock today)
  domain/                types, verification, eligibility, pricing (pure, unit-tested)
  mock/                  fictional catalogue, prices, simulated readings, sample pack drawings
  components/            UploadPanel, ManualSearch, VerificationPanel, MedicineCard,
                         PriceProvenance, SavingsBreakdown, SummaryDocument, ui
  screens/               the five screens
  summary/               builds the summary once for screen, file and text
  i18n.ts                English and Hindi text
  App.tsx                flow and state
tests/domain.test.ts
build.mjs                bundles everything into one HTML page
```

## Not in scope

Medicine sales, checkout or delivery; prescriptions, diagnosis or dose advice; switching recommendations; live availability; accounts; storing personal or medical data.
