// Home-page example: one real comparison read from the catalogue, so the figures
// always follow the same rules as the comparison screen (current, verified MRP only).
// Hidden when the example medicine has no current price or no eligible alternative.
import { api } from "../api/client";
import { ComparableProduct } from "../domain/types";
import { calculateSavings } from "../domain/pricing";
import { useI18n } from "../i18n";
import { inr, fmtDate } from "../lib/format";
import { Icon } from "./Icon";

const { useState, useEffect } = React;

const EXAMPLE_ID = "real_telma_40";

interface Pair { current: ComparableProduct; alt: ComparableProduct; monthly: number }

export function ExampleComparison() {
  const { t, lang } = useI18n();
  const [pair, setPair] = useState<Pair | null>(null);

  useEffect(() => {
    let live = true;
    api.getComparison(EXAMPLE_ID).then((r) => {
      let best: Pair | null = null;
      for (const alt of r.alternatives) {
        const s = calculateSavings(r.current, alt, "MRP", 1);
        if (s.ok && s.monthlySaving > 0 && (!best || s.monthlySaving > best.monthly)) best = { current: r.current, alt, monthly: s.monthlySaving };
      }
      if (live) setPair(best);
    }, () => live && setPair(null));
    return () => { live = false; };
  }, []);

  if (!pair) return null;
  const { current, alt, monthly } = pair;
  const row = (p: ComparableProduct, cheaper: boolean) => (
    <div className={`ex-row${cheaper ? " ex-alt" : ""}`}>
      <strong>{p.brand_name}</strong>
      <span>{t.exPerTablet(inr(p.mrp!.per_unit!, true))}</span>
    </div>
  );
  const date = alt.mrp?.last_verified_at ?? current.mrp?.last_verified_at;
  const src = alt.mrp ? t.sources[alt.mrp.price_source] : "";

  return (
    <div className="example" aria-label={t.exTitle}>
      <p className="example-title"><Icon name="listChecks" size={16} />{t.exTitle}</p>
      <p className="muted small">{t.exSame(`${current.active_ingredients.join(" + ")} ${current.strength}`)}</p>
      {row(current, false)}
      {row(alt, true)}
      <p className="ex-save">{t.exMonthly(inr(monthly))}</p>
      {date && <p className="muted small">{t.exNote(src, fmtDate(date, lang))}</p>}
    </div>
  );
}
