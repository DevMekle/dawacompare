// Builds the comparison summary once, as plain structured text, so the on-screen
// view, the downloadable HTML file and the copy-as-text version all say the same thing.
// Deliberately holds no personal data: no name, age, condition or prescription details.

import type { Strings, Lang } from "../i18n";
import { withAi } from "../i18n";
import type { ComparableProduct, PriceQuote, PriceType } from "../domain/types";
import type { SavingsOutcome } from "../domain/pricing";
import { inr, fmtDate, fmtNum } from "../lib/format";

export type ConfirmedHow = "matched" | "vision" | "chosen" | "manual" | "pack";

export interface SummaryInput {
  current: ComparableProduct;
  alternatives: ComparableProduct[];
  selectedId: string | null;
  basis: PriceType;
  unitsPerDay: number | null;
  outcome: SavingsOutcome | null;
  how: ConfirmedHow;
  prepared: Date;
  aiName?: string | null;
  /** Demo mode uses the sample-data notes; live mode the real-data notes. */
  demo?: boolean;
}

export interface Summary {
  title: string;
  prepared: string;
  confirmed: { heading: string; rows: [string, string][] };
  alternatives: { heading: string; columns: string[]; rows: { cells: string[]; used: boolean }[]; empty: string | null };
  estimate: { heading: string; rows: [string, string][]; highlight: [string, string][]; note: string | null };
  assumptions: { heading: string; items: string[] };
  notes: string[];
  /** Sample data: the report carries a SAMPLE DATA tag. */
  demo: boolean;
}

export function priceText(q: PriceQuote | null, t: Strings, lang: Lang): string {
  if (!q) return t.noPriceRecord;
  if (q.freshness === "unverified") return t.noVerifiedPrice;
  const base = `${inr(q.amount, true)} / ${q.pack_quantity}`;
  if (q.freshness === "stale") return `${base} · ${t.fresh.stale} (${t.lastVerified.toLowerCase()} ${fmtDate(q.last_verified_at!, lang)})`;
  return `${base} · ${t.fresh.current}`;
}

function provenance(p: ComparableProduct, t: Strings, lang: Lang): string {
  const src = p.price_source ? t.sources[p.price_source] : "—";
  const when = p.last_verified_at ? fmtDate(p.last_verified_at, lang) : t.never;
  return `${src} · ${when}`;
}

function perUnit(p: ComparableProduct, basis: PriceType): string {
  const q = basis === "MRP" ? p.mrp : p.actual_selling_price;
  return q?.per_unit != null ? inr(q.per_unit, true) : "—";
}

export function buildSummary(s: SummaryInput, t: Strings, lang: Lang): Summary {
  const c = s.current;
  const formulation = (p: ComparableProduct) => `${p.active_ingredients.join(" + ")} · ${p.strength} · ${t.forms[p.dosage_form]}`;
  const how = s.how === "matched" ? t.rptHowMatched : s.how === "vision" ? withAi(t.rptHowVision, s.aiName ?? null) : s.how === "chosen" ? t.rptHowChosen : s.how === "pack" ? t.rptHowPack : t.rptHowManual;

  const confirmed: [string, string][] = [
    [t.fields.brand_name, c.brand_name],
    [t.fields.active_ingredients, c.active_ingredients.join(" + ")],
    [t.fields.strength, c.strength],
    [t.fields.dosage_form, t.forms[c.dosage_form]],
    [t.manufacturer, c.manufacturer ?? "—"],
    [t.priceTypes.MRP, priceText(c.mrp, t, lang)],
    [t.priceTypes.SELLING_PRICE, c.actual_selling_price ? priceText(c.actual_selling_price, t, lang) : t.noVerifiedPrice],
    [`${t.source} · ${t.lastVerified}`, provenance(c, t, lang)],
    [t.rptHow, how],
  ];

  const altRows = s.alternatives.map((a) => ({
    used: a.medicine_id === s.selectedId,
    cells: [
      `${a.brand_name}${a.manufacturer ? ` (${a.manufacturer})` : ""}${a.medicine_id === s.selectedId ? ` · ${t.rptUsed}` : ""}`,
      formulation(a),
      priceText(a.mrp, t, lang),
      a.actual_selling_price ? priceText(a.actual_selling_price, t, lang) : "—",
      perUnit(a, s.basis),
      provenance(a, t, lang),
      a.medicine_id.startsWith("ja_") ? `${t.jaBadge}: ${t.jaNote}` : a.medicine_id.startsWith("real_") ? `${t.brandBadge}: ${t.brandNote}` : t.reviewNote,
    ],
  }));

  const est: [string, string][] = [];
  const highlight: [string, string][] = [];
  let note: string | null = null;
  const sel = s.alternatives.find((a) => a.medicine_id === s.selectedId);
  if (sel) est.push([t.comparing, `${c.brand_name} → ${sel.brand_name}`]);
  est.push([t.rptBasis, t.priceTypes[s.basis]]);
  if (s.unitsPerDay) est.push([t.rptQty, fmtNum(s.unitsPerDay)]);
  if (s.outcome?.ok) {
    const o = s.outcome;
    est.push(
      [`${t.current} · ${t.perTab}`, t.normLine(inr(o.current.amount, true), o.current.pack_quantity, inr(o.current.per_unit, true))],
      [`${t.alternative} · ${t.perTab}`, t.normLine(inr(o.alternative.amount, true), o.alternative.pack_quantity, inr(o.alternative.per_unit, true))],
      [`${t.current} · ${t.monthly} / ${t.annual}`, `${inr(o.current.monthly)} / ${inr(o.current.annual)}`],
      [`${t.alternative} · ${t.monthly} / ${t.annual}`, `${inr(o.alternative.monthly)} / ${inr(o.alternative.annual)}`],
    );
    if (o.monthlySaving > 0) highlight.push([t.saveMonth, inr(o.monthlySaving)], [t.saveYear, inr(o.annualSaving)]);
    else note = t.noSaving;
  } else if (s.outcome && !s.outcome.ok) {
    note = `${t.rptNoEstimate}. ` + s.outcome.problems.map((p) => (p.issue === "stale" ? t.problems.stale(p.brand_name, fmtDate(p.last_verified_at!, lang)) : t.problems[p.issue](p.brand_name))).join(" ");
  } else {
    note = t.rptNoEstimate;
  }

  return {
    title: t.rptTitle,
    prepared: `${t.rptPrepared}: ${fmtDate(s.prepared, lang)}`,
    confirmed: { heading: t.rptConfirmed, rows: confirmed },
    alternatives: {
      heading: t.rptAlts,
      columns: [t.fields.brand_name, `${t.fields.active_ingredients} · ${t.fields.strength}`, t.priceTypes.MRP, t.priceTypes.SELLING_PRICE, `${t.perTab} (${t.priceTypes[s.basis]})`, `${t.source} · ${t.lastVerified}`, s.demo ? t.reviewedAlt : t.colResult],
      rows: altRows,
      empty: altRows.length ? null : t.emptyTitle,
    },
    estimate: { heading: t.rptEstimate, rows: est, highlight, note },
    assumptions: { heading: t.assumptionsTitle, items: [t.formulaMonthly, t.formulaAnnual, ...t.assumptions(t.priceTypes[s.basis])] },
    demo: !!s.demo,
    notes: [t.caution, t.rptReminder, s.demo ? t.rptReview : t.rptReviewReal, s.demo ? t.sampleNote : t.realNote, t.rptPrivacy],
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] as string);

export function summaryToText(s: Summary, t: Strings): string {
  const L: string[] = [`${t.brand} — ${s.title}`, ...(s.demo ? [`*** ${t.demoData} ***`] : []), s.prepared, "", `## ${s.confirmed.heading}`];
  s.confirmed.rows.forEach(([k, v]) => L.push(`${k}: ${v}`));
  L.push("", `## ${s.alternatives.heading}`);
  if (s.alternatives.empty) L.push(s.alternatives.empty);
  s.alternatives.rows.forEach((r) => {
    L.push(`- ${r.cells[0]}`);
    r.cells.slice(1).forEach((cell, i) => L.push(`    ${s.alternatives.columns[i + 1]}: ${cell}`));
  });
  L.push("", `## ${s.estimate.heading}`);
  s.estimate.rows.forEach(([k, v]) => L.push(`${k}: ${v}`));
  s.estimate.highlight.forEach(([k, v]) => L.push(`${k}: ${v}`));
  if (s.estimate.note) L.push(s.estimate.note);
  L.push("", `## ${s.assumptions.heading}`, ...s.assumptions.items.map((i) => `- ${i}`), "", ...s.notes);
  return L.join("\n");
}

export function summaryToHtml(s: Summary, t: Strings, lang: Lang): string {
  const kv = (rows: [string, string][]) => rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  const alts = s.alternatives.empty
    ? `<p>${esc(s.alternatives.empty)}</p>`
    : `<div class="scroll"><table class="alts"><thead><tr>${s.alternatives.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${s.alternatives.rows
        .map((r) => `<tr${r.used ? ' class="used"' : ""}>${r.cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.brand)} — ${esc(s.title)}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: "Segoe UI", "Noto Sans Devanagari", Mukta, system-ui, sans-serif; color: #10201D; background: #fff; margin: 0; padding: 24px; line-height: 1.45; font-size: 14px; }
.wrap { max-width: 860px; margin: 0 auto; }
header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 2px solid #10201D; padding-bottom: 10px; }
h1 { font-size: 22px; margin: 2px 0; } h2 { font-size: 15px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .06em; color: #173B34; }
.brand { font-weight: 700; color: #1F6E53; } .muted { color: #4A5B56; font-size: 12.5px; }
.tag { border: 1.5px solid #B45309; color: #8A3F06; font-weight: 700; font-size: 11px; letter-spacing: .08em; padding: 3px 8px; border-radius: 4px; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; } th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #DDE3DF; }
tbody th { width: 34%; color: #3D4F4A; font-weight: 600; }
.alts { font-size: 12.5px; } .alts thead th { background: #EEF3EF; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.alts tr.used td { background: #E3F4EC; font-weight: 600; } .scroll { overflow-x: auto; }
.hl { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; } .hl div { flex: 1 1 200px; border: 1px solid #DDE3DF; border-radius: 8px; padding: 10px 12px; } .hl b { display: block; font-size: 20px; }
.note { border: 1px solid #E8C98A; background: #FFF7E6; border-radius: 8px; padding: 10px 12px; margin-top: 18px; }
ul { margin: 0; padding-left: 18px; }
</style></head><body><div class="wrap">
<header><div><div class="brand">${esc(t.brand)}</div><h1>${esc(s.title)}</h1><div class="muted">${esc(s.prepared)}</div></div>${s.demo ? `<div class="tag">${esc(t.demoData)}</div>` : ""}</header>
<h2>${esc(s.confirmed.heading)}</h2><table><tbody>${kv(s.confirmed.rows)}</tbody></table>
<h2>${esc(s.alternatives.heading)}</h2>${alts}
<h2>${esc(s.estimate.heading)}</h2><table><tbody>${kv(s.estimate.rows)}</tbody></table>
${s.estimate.highlight.length ? `<div class="hl">${s.estimate.highlight.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join("")}</div>` : ""}
${s.estimate.note ? `<p><b>${esc(s.estimate.note)}</b></p>` : ""}
<h2>${esc(s.assumptions.heading)}</h2><ul>${s.assumptions.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
<div class="note"><b>${esc(s.notes[0])}</b><br>${esc(s.notes[1])}</div>
${s.notes.slice(2).map((n) => `<p class="muted">${esc(n)}</p>`).join("")}
</div></body></html>`;
}
