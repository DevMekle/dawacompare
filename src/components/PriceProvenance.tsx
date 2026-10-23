// Shows each stored price with its type, freshness, source and last-verified date.
// Unverified prices are never displayed as amounts; stale ones are shown muted and flagged.
import { ComparableProduct, PriceQuote } from "../domain/types";
import { useI18n } from "../i18n";
import { inr, fmtDate } from "../lib/format";
import { Chip } from "./ui";

function QuoteRow({ label, q }: { label: string; q: PriceQuote | null }) {
  const { t, lang } = useI18n();
  if (!q) {
    return (
      <div className="pq">
        <span className="pq-label">{label}</span>
        <span className="pq-amt is-na">{t.noPriceRecord}</span>
        <Chip tone="warn" icon="alert">{t.fresh.unverified}</Chip>
      </div>
    );
  }
  const chip = q.freshness === "current" ? <Chip tone="ok" icon="check">{t.fresh.current}</Chip> : q.freshness === "stale" ? <Chip tone="warn" icon="clock">{t.fresh.stale}</Chip> : <Chip tone="warn" icon="alert">{t.fresh.unverified}</Chip>;
  return (
    <div className={`pq pq-${q.freshness}`}>
      <span className="pq-label">{label}</span>
      {q.freshness === "unverified" ? (
        <span className="pq-amt is-na">{t.noVerifiedPrice}</span>
      ) : (
        <span className="pq-amt">
          <span className="pq-num">{inr(q.amount, true)}</span>
          <span className="pq-pack"> / {q.pack_quantity}</span>
          {q.per_unit != null && <span className="pq-unit">{inr(q.per_unit, true)} {t.perTab}</span>}
        </span>
      )}
      {chip}
      <span className="pq-src">
        {t.sources[q.price_source]} · {t.lastVerified}: {q.last_verified_at ? fmtDate(q.last_verified_at, lang) : t.never}
      </span>
      {q.freshness === "stale" && <span className="pq-note">{t.staleNote(fmtDate(q.last_verified_at!, lang))}</span>}
      {q.freshness === "unverified" && <span className="pq-note">{t.unverifiedNote}</span>}
    </div>
  );
}

export function PriceProvenance({ product }: { product: ComparableProduct }) {
  const { t } = useI18n();
  return (
    <div className="prov">
      <QuoteRow label={t.priceTypes.MRP} q={product.mrp} />
      {product.actual_selling_price && <QuoteRow label={t.priceTypes.SELLING_PRICE} q={product.actual_selling_price} />}
    </div>
  );
}
