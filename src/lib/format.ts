import type { Lang } from "../i18n";

/** Indian rupee formatting: ₹1,20,000 grouping, two decimals unless the amount is whole. */
export function inr(n: number, forceDecimals = false): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole && !forceDecimals ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtDate(iso: string | Date, lang: Lang): string {
  const d = typeof iso === "string" ? new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")) : iso;
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
