import { SavingsOutcome } from "../domain/pricing";
import { useI18n } from "../i18n";
import { fmtDate } from "../lib/format";
import { Icon } from "./Icon";

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
