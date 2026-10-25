// Steps 3 and 4. "compare": the customer picks an alternative. "savings": the customer
// enters tablets a day, then sees the saving with share / download / save. Nothing is
// preselected: both choices stay with the customer. The detailed calculation lives in the
// downloadable / shareable report, not on screen.

import { useI18n } from "../i18n";
import { ComparisonResponse, ComparableProduct, PriceType } from "../domain/types";
import { SavingsOutcome, calculateSavings } from "../domain/pricing";
import { Summary, summaryToHtml, summaryToText } from "../summary/buildSummary";
import { inr } from "../lib/format";
import { DEMO } from "../lib/mode";
import { api } from "../api/client";
import { Icon } from "../components/Icon";
import { ActionBar, Notice, Segmented, Spinner } from "../components/ui";
import { MedicineCard } from "../components/MedicineCard";
import { SavingsBlocked } from "../components/SavingsBreakdown";
import { SummaryDocument } from "../components/SummaryDocument";

const { useState, useRef } = React;

/** How this view can hand over a file: the artifact viewer's downloads capability, a normal browser download, or nothing. */
export type Downloader = { kind: "claude"; ns: any } | { kind: "native" } | { kind: "none" } | { kind: "pending" };

type Kind = "all" | "brand" | "ja";
const kindOf = (id: string): Exclude<Kind, "all"> => (id.startsWith("ja_") ? "ja" : "brand");
const DOSES = [0.5, 1, 2, 3];

interface Props {
  mode: "compare" | "savings";
  onNext: () => void;
  headRef: any;
  state: "loading" | "error" | "ready";
  data: ComparisonResponse | null;
  onRetry: () => void;
  onNew: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: "price" | "name";
  setSort: (s: "price" | "name") => void;
  unitsPerDay: number | null;
  setUnitsPerDay: (n: number | null) => void;
  basis: PriceType;
  setBasis: (b: PriceType) => void;
  bases: PriceType[];
  outcome: SavingsOutcome | null;
  summary: Summary | null;
  downloader: Downloader;
  canPrint: boolean;
  shareText: string;
  onShared: () => void;
  isSaved: boolean;
  onSave: () => void;
  feedbackContext: Record<string, unknown>;
  catalogue: { source: string; medicines: number } | null;
}

/** Anonymous "Was this helpful?" box. Stored only when the live backend accepts it. */
function FeedbackBox({ context }: { context: Record<string, unknown> }) {
  const { t } = useI18n();
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const send = async () => {
    setState("sending");
    const ok = await api.sendFeedback({ kind: "feedback", helpful, comment: comment.trim() || null, ...context });
    setState(ok ? "sent" : "failed");
  };
  if (state === "sent") return <Notice tone="ok" icon="circleCheck" role="status">{t.fbThanks}</Notice>;
  return (
    <div className="feedback">
      <strong id="fb-title">{t.fbTitle}</strong>
      <div className="feedback-row" role="group" aria-labelledby="fb-title">
        <button type="button" className={`btn btn-quiet ${helpful === true ? "on" : ""}`} aria-pressed={helpful === true} onClick={() => setHelpful(true)}><Icon name="check" size={16} />{t.fbYes}</button>
        <button type="button" className={`btn btn-quiet ${helpful === false ? "on" : ""}`} aria-pressed={helpful === false} onClick={() => setHelpful(false)}><Icon name="x" size={16} />{t.fbNo}</button>
      </div>
      {helpful !== null && (
        <>
          <textarea id="fb-comment" aria-label={t.fbPlaceholder} placeholder={t.fbPlaceholder} maxLength={1000} value={comment} onChange={(e: any) => setComment(e.target.value)} />
          <div className="feedback-row">
            <button type="button" className="btn btn-secondary" onClick={send} disabled={state === "sending"}>{t.fbSend}</button>
            {state === "failed" && <span className="muted small" role="status">{t.fbFail}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** The saving for the selected alternative: two numbers and one line, nothing else. */
function SavingCard({ outcome, alt, units }: { outcome: SavingsOutcome; alt: ComparableProduct; units: number }) {
  const { t } = useI18n();
  if (!outcome.ok) return <SavingsBlocked outcome={outcome} />;
  const saving = outcome.monthlySaving > 0;
  return (
    <div className="card save-card" role="status" aria-live="polite">
      <p className="save-with">{t.saveWith(alt.brand_name)}</p>
      {saving ? (
        <div className="save-hero">
          <div className="save-tile"><span className="save-label">{t.perMonth}</span><span className="save-num">{inr(outcome.monthlySaving)}</span></div>
          <div className="save-tile"><span className="save-label">{t.perYear}</span><span className="save-num save-num-lg">{inr(outcome.annualSaving)}</span></div>
        </div>
      ) : <p className="save-none">{t.noSaving}</p>}
      <p className="muted small">{t.saveLine(inr(outcome.current.monthly), inr(outcome.alternative.monthly), units)}</p>
    </div>
  );
}

export function ResultScreen(p: Props) {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState<Kind>("all");
  const [other, setOther] = useState(p.unitsPerDay != null && !DOSES.includes(p.unitsPerDay));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const head = <h1 ref={p.headRef} tabIndex={-1} className="visually-hidden">{p.mode === "compare" ? t.s3Title : t.s4Title}</h1>;
  if (p.state !== "ready" || !p.data) {
    return (
      <section className="screen">
        {head}
        {p.state === "error" ? (
          <>
            <Notice tone="block" icon="alert" role="alert">{t.loadErr}</Notice>
            <button type="button" className="btn btn-secondary" onClick={p.onRetry}><Icon name="rotate" size={18} />{t.tryAgain}</button>
          </>
        ) : (
          <div className="loading-list" role="status" aria-live="polite">
            <p className="muted"><Spinner />{t.loadingAlts}</p>
            {[0, 1, 2].map((i) => <div key={i} className="skel-card"><span /><span /><span /></div>)}
          </div>
        )}
      </section>
    );
  }

  const { current, alternatives, excluded } = p.data;
  const units = p.unitsPerDay ?? 0;
  const perTabSaving = (a: ComparableProduct) => {
    const o = calculateSavings(current, a, "MRP", 1);
    return o.ok ? o.current.per_unit - o.alternative.per_unit : null;
  };
  const unit = (x: ComparableProduct) => x.mrp?.per_unit ?? Infinity;
  const nBrand = alternatives.filter((a) => kindOf(a.medicine_id) === "brand").length;
  const nJa = alternatives.length - nBrand;
  const showFilter = nBrand > 0 && nJa > 0;
  const shown = showFilter && kind !== "all" ? alternatives.filter((a) => kindOf(a.medicine_id) === kind) : alternatives;
  const sorted = [...shown].sort((a, b) => (p.sort === "name" ? a.brand_name.localeCompare(b.brand_name) : unit(a) - unit(b)));
  const alt = alternatives.find((a) => a.medicine_id === p.selectedId) ?? null;

  const filename = `DawaCompare-summary-${new Date().toISOString().slice(0, 10)}.html`;
  const download = async () => {
    if (!p.summary) return;
    const html = summaryToHtml(p.summary, t, lang);
    if (p.downloader.kind === "claude") {
      setBusy(true);
      try { await p.downloader.ns.save({ filename, data: html }); setMsg({ ok: true, text: t.downloaded }); }
      catch (e: any) { setMsg({ ok: false, text: e?.code === "declined" ? t.dlDeclined : t.dlUnavailable }); }
      finally { setBusy(false); }
    } else if (p.downloader.kind === "native") {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg({ ok: true, text: t.downloaded });
    } else setMsg({ ok: false, text: t.dlUnavailable });
  };
  const copy = () => {
    if (!p.summary) return;
    const text = summaryToText(p.summary, t);
    try { navigator.clipboard.writeText(text).then(() => setMsg({ ok: true, text: t.copied }), () => setMsg({ ok: false, text: t.copyFail })); } catch { setMsg({ ok: false, text: t.copyFail }); }
  };
  const ready = !!alt && !!p.summary && !!p.outcome && !!units;

  if (p.mode === "savings" && alt) {
    return (
      <section className="screen">
        {head}
        <p className="pair"><span className="muted">{t.comparing}</span> <strong>{current.brand_name}</strong> <Icon name="arrowRight" size={14} /> <strong>{alt.brand_name}</strong></p>
        <div className="card dose-card">
          <span className="field-label" id="qty-label">{t.calcTitle}</span>
          <Segmented<number | "other">
            id="qty" label={t.calcTitle}
            value={other ? "other" : p.unitsPerDay}
            options={[...DOSES.map((d) => ({ value: d as number | "other", label: d === 0.5 ? "½" : String(d) })), { value: "other" as const, label: t.other }]}
            onChange={(v) => { if (v === "other") { setOther(true); p.setUnitsPerDay(null); } else { setOther(false); p.setUnitsPerDay(v); } }}
          />
          {other && (
            <input id="qty-other" className="input" type="number" inputMode="decimal" min={0.25} max={20} step="any" aria-labelledby="qty-label" placeholder={t.otherQtyHint}
              value={p.unitsPerDay ?? ""} onChange={(e: any) => { const n = parseFloat(e.target.value); p.setUnitsPerDay(Number.isFinite(n) && n > 0 && n <= 20 ? n : null); }} />
          )}
          <p className="field-hint"><Icon name="stethoscope" size={14} />{t.calcHelp}</p>
          {p.bases.length > 1 && (
            <Segmented<PriceType> label={t.basisTitle} value={p.basis} onChange={p.setBasis}
              options={(["MRP", "SELLING_PRICE"] as PriceType[]).map((b) => ({ value: b, label: t.priceTypes[b] }))} />
          )}
        </div>

        {p.outcome && units > 0 ? <SavingCard outcome={p.outcome} alt={alt} units={units} /> : <div className="qty-prompt"><Icon name="info" size={18} />{t.enterQty}</div>}

        <Notice tone="warn" icon="stethoscope"><strong>{t.caution}</strong></Notice>
        {msg && <Notice tone={msg.ok ? "ok" : "warn"} icon={msg.ok ? "circleCheck" : "alert"} role="status">{msg.text}</Notice>}
        {ready && (
          <div className="secondary-row">
            {p.downloader.kind !== "none" && <button type="button" className="btn btn-quiet" onClick={download} disabled={busy}><Icon name="download" size={16} />{busy ? t.downloading : t.downloadReport}</button>}
            <button type="button" className="btn btn-quiet" onClick={copy}><Icon name="copy" size={16} />{t.copy}</button>
            <button type="button" className="btn btn-quiet" onClick={p.onSave} disabled={p.isSaved} aria-pressed={p.isSaved}><Icon name={p.isSaved ? "check" : "plus"} size={16} />{p.isSaved ? t.savedMed : t.saveMed}</button>
            {p.canPrint && <button type="button" className="btn btn-quiet" onClick={() => window.print()}><Icon name="printer" size={16} />{t.print}</button>}
            <button type="button" className="btn btn-quiet" onClick={p.onNew}><Icon name="rotate" size={16} />{t.newComparison}</button>
          </div>
        )}
        {ready && <div className="print-only"><SummaryDocument s={p.summary!} docRef={docRef} /></div>}
        {ready && !DEMO && <FeedbackBox context={p.feedbackContext} />}

        <ActionBar hint={!units ? <p className="bar-hint">{t.enterQty}</p> : null}>
          {ready ? (
            <a className="btn btn-primary btn-wa" href={`https://wa.me/?text=${encodeURIComponent(p.shareText)}`} target="_blank" rel="noopener noreferrer" onClick={p.onShared}><Icon name="arrowRight" size={20} />{t.shareWhatsApp}</a>
          ) : (
            <button type="button" className="btn btn-primary is-blocked" aria-disabled="true"><Icon name="arrowRight" size={20} />{t.shareWhatsApp}</button>
          )}
        </ActionBar>
      </section>
    );
  }

  return (
    <section className="screen">
      {head}
      <MedicineCard product={current} variant="current" />

      {alternatives.length === 0 ? (
        <>
          <div className="empty">
            <Icon name="searchX" size={32} className="empty-icon" />
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyBody}</p>
            <p className="muted">{t.emptyNext}</p>
          </div>
          <ActionBar>
            <button type="button" className="btn btn-primary" onClick={p.onNew}><Icon name="rotate" size={20} />{t.newComparison}</button>
          </ActionBar>
        </>
      ) : (
        <>
          <div className="list-head">
            <h2 className="list-title">{t.optionsCount(alternatives.length)}</h2>
            <div className="sort">
              <label htmlFor="sort">{t.sortBy}</label>
              <select id="sort" className="input input-sm" value={p.sort} onChange={(e: any) => p.setSort(e.target.value)}>
                <option value="price">{t.sortPrice}</option>
                <option value="name">{t.sortName}</option>
              </select>
            </div>
          </div>
          {showFilter && (
            <div className="alt-filter"><Segmented<Kind> label={t.filterLabel} value={kind} onChange={setKind} options={[
              { value: "all", label: t.filterAll(alternatives.length) },
              { value: "brand", label: t.filterBrand(nBrand) },
              { value: "ja", label: t.filterJa(nJa) },
            ]} /></div>
          )}
          <div className="alts" role="radiogroup" aria-label={t.s3Title}>
            {sorted.map((a) => (
              <MedicineCard key={a.medicine_id} product={a} variant="alternative" selected={p.selectedId === a.medicine_id} onSelect={() => p.onSelect(a.medicine_id)} perTabSaving={perTabSaving(a)} />
            ))}
          </div>

          {excluded.length > 0 && (
            <details className="excluded">
              <summary><Icon name="ban" size={18} /><span>{t.excludedTitle}</span><Icon name="chevronDown" size={18} className="chev" /></summary>
              <p className="muted small">{t.excludedBody}</p>
              <ul>{excluded.map((e) => <li key={e.reason}><span>{t.excludedReasons[e.reason]}</span><span className="count">{e.count}</span></li>)}</ul>
            </details>
          )}

          <Notice tone="info" icon="info">{DEMO ? t.sampleNote : t.realNote}</Notice>
          {p.catalogue && <p className="cat-src muted small"><Icon name="database" size={14} />{t.catalogueFrom(p.catalogue.source, p.catalogue.medicines)}</p>}
          <ActionBar hint={!alt ? <p className="bar-hint">{t.selectHint}</p> : null}>
            <button type="button" className={`btn btn-primary ${alt ? "" : "is-blocked"}`} aria-disabled={!alt} onClick={() => alt && p.onNext()}>
              {t.seeSavings}<Icon name="arrowRight" size={18} />
            </button>
          </ActionBar>
        </>
      )}
    </section>
  );
}
