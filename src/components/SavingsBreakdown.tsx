import { SavingsOutcome, DAYS_PER_MONTH, MONTHS_PER_YEAR } from "../domain/pricing";
import { useI18n } from "../i18n";
import { inr, fmtDate, fmtNum } from "../lib/format";
import { Icon } from "./Icon";
import { DemoTag } from "./ui";

interface Props {
  outcome: SavingsOutcome;
  currentName: string;
  altName: string;
}

export function SavingsBlocked({ outcome }: { outcome: Extract<SavingsOutcome, { ok: false }> }) {
  const { t, lang } = useI18n();
  return (
    <div className="blocked" role="status">
      <div className="blocked-head"><Icon name="ban" size={20} /><strong>{t.blockedTitle}</strong></div>
      <p>{t.blockedBody}</p>
      <ul>
        {outcome.problems.map((p) => (
          <li key={p.who}>
            <span className="chip chip-mute">{p.who === "current" ? t.current : t.alternative}</span>
            {p.issue === "stale" ? t.problems.stale(p.brand_name, fmtDate(p.last_verified_at!, lang)) : t.problems[p.issue](p.brand_name)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SavingsBreakdown({ outcome, currentName, altName }: Props) {
  const { t } = useI18n();
  if (!outcome.ok) return <SavingsBlocked outcome={outcome} />;
  const o = outcome;
  const saving = o.monthlySaving > 0;
  const max = Math.max(o.current.monthly, o.alternative.monthly, 1);
  const basis = t.priceTypes[o.basis];

  return (
    <div className="savings">
      <div className="save-hero">
        <div className="save-tile">
          <span className="save-label">{t.saveMonth}</span>
          <span className="save-num">{saving ? inr(o.monthlySaving) : t.noSaving}</span>
        </div>
        <div className="save-tile">
          <span className="save-label">{t.saveYear}</span>
          <span className="save-num save-num-lg">{saving ? inr(o.annualSaving) : "—"}</span>
        </div>
        <DemoTag />
      </div>

      <div className="card">
        <div className="bars">
          {[
            { k: "cur", label: t.current, name: currentName, v: o.current.monthly },
            { k: "alt", label: t.alternative, name: altName, v: o.alternative.monthly },
          ].map((b) => (
            <div className="bar" key={b.k}>
              <div className="bar-label"><span><strong>{b.label}</strong> · {b.name}</span><span className="bar-val">{inr(b.v)} <small>/ {t.monthly.toLowerCase()}</small></span></div>
              <div className="bar-track"><div className={`bar-fill bar-${b.k}`} style={{ width: `${(b.v / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <table className="cost-table">
          <thead><tr><th scope="col"><span className="visually-hidden">—</span></th><th scope="col">{t.monthly}</th><th scope="col">{t.annual}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{t.current}</th><td>{inr(o.current.monthly)}</td><td>{inr(o.current.annual)}</td></tr>
            <tr><th scope="row">{t.alternative}</th><td>{inr(o.alternative.monthly)}</td><td>{inr(o.alternative.annual)}</td></tr>
            <tr className="tot"><th scope="row">{t.saving}</th><td>{inr(o.monthlySaving)}</td><td>{inr(o.annualSaving)}</td></tr>
          </tbody>
        </table>
      </div>

      <details className="calc" open>
        <summary><Icon name="listChecks" size={18} /><span>{t.formulaTitle}</span><Icon name="chevronDown" size={18} className="chev" /></summary>
        <h3 className="calc-h">{t.normTitle} · {basis}</h3>
        <ul className="calc-lines">
          <li><span>{currentName}</span><code>{t.normLine(inr(o.current.amount, true), o.current.pack_quantity, inr(o.current.per_unit, true))}</code></li>
          <li><span>{altName}</span><code>{t.normLine(inr(o.alternative.amount, true), o.alternative.pack_quantity, inr(o.alternative.per_unit, true))}</code></li>
        </ul>
        <p className="formula">{t.formulaMonthly}</p>
        <p className="formula">{t.formulaAnnual}</p>
        <ul className="calc-lines">
          <li><span>{t.current}</span><code>{fmtNum(o.unitsPerDay)} × {DAYS_PER_MONTH} × {inr(o.current.per_unit, true)} = {inr(o.current.monthly)}</code></li>
          <li><span>{t.alternative}</span><code>{fmtNum(o.unitsPerDay)} × {DAYS_PER_MONTH} × {inr(o.alternative.per_unit, true)} = {inr(o.alternative.monthly)}</code></li>
          <li><span>{t.saveMonth}</span><code>{inr(o.current.monthly)} − {inr(o.alternative.monthly)} = {inr(o.monthlySaving)}</code></li>
          <li><span>{t.saveYear}</span><code>{inr(o.monthlySaving)} × {MONTHS_PER_YEAR} = {inr(o.annualSaving)}</code></li>
        </ul>
        <h3 className="calc-h">{t.assumptionsTitle}</h3>
        <ul className="assume">{t.assumptions(basis).map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
    </div>
  );
}
