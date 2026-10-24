// Picks the catalogue for API requests: PostgreSQL when DATABASE_URL (or POSTGRES_URL) is set, otherwise the bundled seed.
import { neon } from "@neondatabase/serverless";
import { CatalogueStore, createSeedStore } from "../src/catalogue/store";
import { createSqlStore } from "./sqlStore";

let cached: CatalogueStore | null = null;

export function getStore(): CatalogueStore {
  if (cached) return cached;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const sql = neon(url);
    cached = createSqlStore({ query: (text, params) => sql(text, (params ?? []) as any[]) as Promise<any[]> });
  } else {
    cached = createSeedStore(undefined, "real");
  }
  return cached;
}
