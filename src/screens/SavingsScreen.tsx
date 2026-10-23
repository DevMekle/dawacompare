import { useI18n } from "../i18n";
import { ComparableProduct, PriceType } from "../domain/types";
import { SavingsOutcome } from "../domain/pricing";
import { Icon } from "../components/Icon";
import { ActionBar, Notice, ScreenHead, Segmented } from "../components/ui";
import { SavingsBreakdown, SavingsBlocked } from "../components/SavingsBreakdown";

const { useState } = React;

interface Props {
  headRef: any;
  current: ComparableProduct;
  alternative: ComparableProduct;
  unitsPerDay: number | null;
  setUnitsPerDay: (n: number | null) => void;
  basis: PriceType;
  setBasis: (b: PriceType) => void;
  bases: PriceType[];
  outcome: SavingsOutcome;
  onNext: () => void;
  onChooseOther: () => void;
}

export function SavingsScreen(p: Props) {
  const { t } = useI18n();
  const [other, setOther] = useState(p.unitsPerDay != null && ![1, 2, 3].includes(p.unitsPerDay));
  const segValue: number | "other" | null = other ? "other" : p.unitsPerDay;
  const needsQty = p.outcome.ok && !p.unitsPerDay;
  const canNext = !needsQty;

  return (
    <section className="screen">
      <ScreenHead headRef={p.headRef} title={t.s4Title} body={t.s4Body} />
      <p className="pair"><span className="muted">{t.comparing}</span> <strong>{p.current.brand_name}</strong> <Icon name="arrowRight" size={14} /> <strong>{p.alternative.brand_name}</strong></p>

      {!p.outcome.ok ? (
        <>
          <SavingsBlocked outcome={p.outcome} />
          <button type="button" className="btn btn-secondary" onClick={p.onChooseOther}><Icon name="arrowLeft" size={18} />{t.chooseOther}</button>
        </>
      ) : (
        <>
          <div className="card calc-card">
            <div className="calc-row">
              <span className="field-label" id="qty-label">{t.calcTitle}</span>
              <Segmented<number | "other">
                id="qty"
                label={t.calcTitle}
                value={segValue}
                options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: "other", label: t.other }]}
                onChange={(v) => {
                  if (v === "other") { setOther(true); p.setUnitsPerDay(null); }
                  else { setOther(false); p.setUnitsPerDay(v); }
                }}
              />
              {other && (
                <input id="qty-other" className="input" type="number" inputMode="decimal" min={0.5} max={20} step={0.5} aria-labelledby="qty-label"
                  value={p.unitsPerDay ?? ""} onChange={(e: any) => { const n = parseFloat(e.target.value); p.setUnitsPerDay(Number.isFinite(n) && n > 0 && n <= 20 ? n : null); }} />
              )}
              <p className="field-hint"><Icon name="stethoscope" size={14} />{t.calcHelp}</p>
            </div>
            <div className="calc-row">
              <span className="field-label">{t.basisTitle}</span>
              <Segmented<PriceType>
                label={t.basisTitle}
                value={p.basis}
                options={(["MRP", "SELLING_PRICE"] as PriceType[]).map((b) => ({ value: b, label: t.priceTypes[b], disabled: !p.bases.includes(b), title: !p.bases.includes(b) ? t.basisUnavailable : undefined }))}
                onChange={p.setBasis}
              />
              {!p.bases.includes("SELLING_PRICE") && <p className="field-hint">{t.priceTypes.SELLING_PRICE}: {t.basisUnavailable}</p>}
            </div>
          </div>

          {needsQty ? (
            <div className="qty-prompt"><Icon name="info" size={18} />{t.enterQty}</div>
          ) : (
            <SavingsBreakdown outcome={p.outcome} currentName={p.current.brand_name} altName={p.alternative.brand_name} />
          )}
        </>
      )}

      <Notice tone="warn" icon="stethoscope"><strong>{t.caution}</strong></Notice>

      <ActionBar hint={needsQty ? <p className="bar-hint">{t.enterQty}</p> : null}>
        <button type="button" className={`btn btn-primary ${canNext ? "" : "is-blocked"}`} aria-disabled={!canNext} onClick={() => canNext && p.onNext()}>
          {t.prepare}<Icon name="arrowRight" size={18} />
        </button>
      </ActionBar>
    </section>
  );
}
