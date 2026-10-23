// Price provenance, pack-size normalisation and savings estimates.
//
// Monthly cost   = units per day × 30 × price per unit
// Annual cost    = monthly cost × 12
// Monthly saving = current monthly cost − alternative monthly cost
// Annual saving  = monthly saving × 12
//
// Savings are only produced when BOTH products have a current, verified quote
// of the SAME price type (MRP with MRP, selling price with selling price).

import { ComparableProduct, MedicineRecord, PriceQuote, PriceRecord, PriceType } from "./types";

export const PRICE_FRESH_DAYS = 90;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso + "T00:00:00Z").getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - then) / 86_400_000);
}

export function toQuote(p: PriceRecord, now: Date): PriceQuote {
  const freshness =
    p.verification_status !== "verified" || !p.last_verified_at ? "unverified"
    : daysSince(p.last_verified_at, now) > PRICE_FRESH_DAYS ? "stale"
    : "current";
  const { price_id, medicine_id, ...rest } = p;
  return { ...rest, freshness, per_unit: freshness === "current" ? p.amount / p.pack_quantity : null };
}

function latest(prices: PriceRecord[], id: string, type: PriceType): PriceRecord | undefined {
  return prices
    .filter((p) => p.medicine_id === id && p.price_type === type)
    .sort((a, b) => (b.last_verified_at ?? "").localeCompare(a.last_verified_at ?? ""))[0];
}

/** Joins a catalogue record with its stored prices, as the backend would. */
export function withPrices(r: MedicineRecord, prices: PriceRecord[], now: Date): ComparableProduct {
  const mrpRec = latest(prices, r.medicine_id, "MRP");
  const spRec = latest(prices, r.medicine_id, "SELLING_PRICE");
  const mrp = mrpRec ? toQuote(mrpRec, now) : null;
  const sp = spRec ? toQuote(spRec, now) : null;
  return {
    ...r,
    mrp,
    // A selling price is only passed on when a current, verified quote exists.
    actual_selling_price: sp && sp.freshness === "current" ? sp : null,
    pack_quantity: mrp?.pack_quantity ?? null,
    price_source: mrp?.price_source ?? null,
    last_verified_at: mrp?.last_verified_at ?? null,
  };
}

export function quoteFor(p: ComparableProduct, basis: PriceType): PriceQuote | null {
  return basis === "MRP" ? p.mrp : p.actual_selling_price;
}

/** Price types on which the two products can be compared fairly. */
export function comparableBases(a: ComparableProduct, b: ComparableProduct): PriceType[] {
  return (["MRP", "SELLING_PRICE"] as PriceType[]).filter((t) => quoteFor(a, t)?.freshness === "current" && quoteFor(b, t)?.freshness === "current");
}

export type PriceIssue = "no_price" | "unverified" | "stale";

export interface PriceProblem {
  who: "current" | "alternative";
  brand_name: string;
  issue: PriceIssue;
  last_verified_at: string | null;
}

export interface SavingsEstimate {
  ok: true;
  basis: PriceType;
  unitsPerDay: number;
  current: { amount: number; pack_quantity: number; per_unit: number; monthly: number; annual: number };
  alternative: { amount: number; pack_quantity: number; per_unit: number; monthly: number; annual: number };
  monthlySaving: number;
  annualSaving: number;
}

export type SavingsOutcome = SavingsEstimate | { ok: false; problems: PriceProblem[] };

function issueOf(q: PriceQuote | null): PriceIssue | null {
  if (!q) return "no_price";
  if (q.freshness === "unverified") return "unverified";
  if (q.freshness === "stale") return "stale";
  return null;
}

export function monthlyCost(unitsPerDay: number, perUnit: number): number {
  return round2(unitsPerDay * DAYS_PER_MONTH * perUnit);
}

export function calculateSavings(current: ComparableProduct, alternative: ComparableProduct, basis: PriceType, unitsPerDay: number): SavingsOutcome {
  const qc = quoteFor(current, basis);
  const qa = quoteFor(alternative, basis);
  const problems: PriceProblem[] = [];
  const ic = issueOf(qc);
  const ia = issueOf(qa);
  if (ic) problems.push({ who: "current", brand_name: current.brand_name, issue: ic, last_verified_at: qc?.last_verified_at ?? null });
  if (ia) problems.push({ who: "alternative", brand_name: alternative.brand_name, issue: ia, last_verified_at: qa?.last_verified_at ?? null });
  if (problems.length || !qc || !qa || !(unitsPerDay > 0)) return { ok: false, problems };

  const side = (q: PriceQuote) => {
    const per_unit = q.amount / q.pack_quantity;
    const monthly = monthlyCost(unitsPerDay, per_unit);
    return { amount: q.amount, pack_quantity: q.pack_quantity, per_unit, monthly, annual: round2(monthly * MONTHS_PER_YEAR) };
  };
  const c = side(qc);
  const a = side(qa);
  const monthlySaving = round2(c.monthly - a.monthly);
  return { ok: true, basis, unitsPerDay, current: c, alternative: a, monthlySaving, annualSaving: round2(monthlySaving * MONTHS_PER_YEAR) };
}
