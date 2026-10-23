import { Summary } from "../summary/buildSummary";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { DemoTag } from "./ui";

export function SummaryDocument({ s, docRef }: { s: Summary; docRef?: any }) {
  const { t } = useI18n();
  return (
    <div className="report" ref={docRef}>
      <header className="report-head">
        <div>
          <p className="report-brand"><Icon name="pill" size={16} />{t.brand}</p>
          <h2>{s.title}</h2>
          <p className="muted small">{s.prepared}</p>
        </div>
        <DemoTag />
      </header>

      <section>
        <h3 className="report-h">{s.confirmed.heading}</h3>
        <dl className="kv">{s.confirmed.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>

      <section>
        <h3 className="report-h">{s.alternatives.heading}</h3>
        {s.alternatives.empty ? (
          <p className="muted">{s.alternatives.empty}</p>
        ) : (
          <div className="report-alts">
            {s.alternatives.rows.map((r) => (
              <div key={r.cells[0]} className={`ralt ${r.used ? "used" : ""}`}>
                <strong>{r.cells[0]}</strong>
                <dl className="kv kv-tight">
                  {r.cells.slice(1).map((c, i) => <div key={i}><dt>{s.alternatives.columns[i + 1]}</dt><dd>{c}</dd></div>)}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="report-h">{s.estimate.heading}</h3>
        <dl className="kv">{s.estimate.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {s.estimate.highlight.length > 0 && (
          <div className="report-sum">{s.estimate.highlight.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
        )}
        {s.estimate.note && <p className="report-estnote">{s.estimate.note}</p>}
      </section>

      <section>
        <h3 className="report-h">{s.assumptions.heading}</h3>
        <ul className="assume">{s.assumptions.items.map((i) => <li key={i}>{i}</li>)}</ul>
      </section>

      <div className="report-note">
        <p><strong>{s.notes[0]}</strong></p>
        <p>{s.notes[1]}</p>
      </div>
      {s.notes.slice(2).map((n) => <p key={n} className="small muted">{n}</p>)}
    </div>
  );
}
