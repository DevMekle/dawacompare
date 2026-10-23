import { ComparableProduct } from "../domain/types";
import { useI18n } from "../i18n";
import { inr } from "../lib/format";
import { Icon } from "./Icon";
import { Chip } from "./ui";
import { PriceProvenance } from "./PriceProvenance";

export function Formulation({ p }: { p: Pick<ComparableProduct, "active_ingredients" | "strength" | "dosage_form" | "release_type"> }) {
  const { t } = useI18n();
  return (
    <div className="facts">
      <span className="fact">{p.active_ingredients.join(" + ")} · {p.strength}</span>
      <span className="fact">{t.forms[p.dosage_form]}</span>
      <span className="fact">{t.releases[p.release_type]}</span>
    </div>
  );
}

interface Props {
  product: ComparableProduct;
  variant: "current" | "alternative";
  selected?: boolean;
  onSelect?: () => void;
  /** Price per tablet of the current medicine, to show the difference. */
  compareTo?: number | null;
}

export function MedicineCard({ product: p, variant, selected, onSelect, compareTo }: Props) {
  const { t } = useI18n();
  const unit = p.mrp?.per_unit ?? null;
  const diff = compareTo != null && unit != null ? compareTo - unit : null;
  const priced = p.mrp?.freshness === "current";
  const reviewed = p.review_status === "approved" && p.verification_status === "verified";

  const body = (
    <>
      <div className="med-head">
        <div className="med-id">
          {variant === "current" ? <p className="med-kicker">{t.yours}</p> : reviewed && <Chip tone="ok" icon="shieldCheck">{t.reviewedAlt}</Chip>}
          <h3 className="med-name">{p.brand_name}</h3>
          {p.manufacturer && <p className="med-maker">{p.manufacturer}</p>}
        </div>
        <div className="price">
          <span className={`price-big ${unit == null ? "is-na" : ""}`}>{unit == null ? "—" : inr(unit, true)}</span>
          <span className="price-unit">{t.perTab} · {t.priceTypes.MRP}</span>
          {diff != null && diff > 0.004 && <span className="price-diff">−{inr(diff, true)}</span>}
        </div>
      </div>
      <Formulation p={p} />
      {p.pack_quantity != null && <p className="med-pack">{t.pack(p.pack_quantity)}{variant === "alternative" && reviewed ? ` · ${t.reviewNote}` : ""}</p>}
      <PriceProvenance product={p} />
      {variant === "alternative" && (
        <>
          {!priced && <p className="med-warn"><Icon name="info" size={16} />{t.cantEstimate}</p>}
          <div className={`alt-select ${selected ? "on" : ""}`}>
            <span className="radio-dot" aria-hidden="true">{selected && <Icon name="check" size={14} />}</span>
            {selected ? t.selected : t.select}
          </div>
        </>
      )}
    </>
  );

  if (variant === "current") return <article className="med med-current" aria-label={t.yours}>{body}</article>;
  return (
    <button type="button" role="radio" aria-checked={!!selected} className={`med med-alt ${selected ? "is-on" : ""} ${priced ? "" : "is-unpriced"}`} onClick={onSelect}>
      {body}
    </button>
  );
}
