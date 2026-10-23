// Creates the tables and loads the sample catalogue into the database at DATABASE_URL.
// Run: DATABASE_URL=postgres://... npm run db:setup   (or put DATABASE_URL in a .env file and use `vercel env pull`)
import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (existsSync(".env.local") && !process.env.DATABASE_URL) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(DATABASE_URL|POSTGRES_URL)\s*=\s*"?([^"]+)"?\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) first.");
  process.exit(1);
}
const sql = neon(url);

/** Splits a SQL file into statements (no semicolons inside our string literals). */
const statements = (file: string) =>
  readFileSync(file, "utf8").split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter((s) => s && !/^(BEGIN|COMMIT)$/i.test(s));

(async () => {
  for (const s of statements("db/schema.sql")) await sql(s);
  console.log("Schema ready.");
  const seed = statements("db/seed.sql");
  await sql.transaction(seed.map((s) => sql(s)));
  const [m] = await sql("SELECT count(*)::int AS n FROM medicines");
  const [p] = await sql("SELECT count(*)::int AS n FROM price_records");
  console.log(`Loaded ${m.n} medicines and ${p.n} price records.`);
})().catch((e) => {
  console.error("Database setup failed:", e.message);
  process.exit(1);
});
