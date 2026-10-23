import { useI18n } from "../i18n";
import { ComparisonResponse } from "../domain/types";
import { Icon } from "../components/Icon";
import { ActionBar, Notice, ScreenHead, Spinner } from "../components/ui";
import { MedicineCard } from "../components/MedicineCard";

interface Props {
  headRef: any;
  state: "loading" | "error" | "ready";
  data: ComparisonResponse | null;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: "price" | "name";
  setSort: (s: "price" | "name") => void;
  onNext: () => void;
  onNew: () => void;
  catalogue: { source: string; medicines: number } | null;
}

export function CompareScreen(p: Props) {
  const { t } = useI18n();

  if (p.state !== "ready" || !p.data) {
    return (
      <section className="screen">
        <ScreenHead headRef={p.headRef} title={t.s3Title} body={t.s3Body} />
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
  const unit = (x: typeof current) => x.mrp?.per_unit ?? Infinity;
  const sorted = [...alternatives].sort((a, b) => (p.sort === "name" ? a.brand_name.localeCompare(b.brand_name) : unit(a) - unit(b)));

  return (
    <section className="screen">
      <ScreenHead headRef={p.headRef} title={t.s3Title} body={t.s3Body} />
      <Notice tone="info" icon="info">{t.sampleNote}</Notice>
      {p.catalogue && <p className="cat-src muted small"><Icon name="database" size={14} />{t.catalogueFrom(p.catalogue.source, p.catalogue.medicines)}</p>}

      <MedicineCard product={current} variant="current" />

      {alternatives.length === 0 ? (
        <div className="empty">
          <Icon name="searchX" size={32} className="empty-icon" />
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
          <p className="muted">{t.emptyNext}</p>
        </div>
      ) : (
        <>
          <div className="list-head">
            <h2 className="list-title">{t.alternativesCount(alternatives.length)}</h2>
            <div className="sort">
              <label htmlFor="sort">{t.sortBy}</label>
              <select id="sort" className="input input-sm" value={p.sort} onChange={(e: any) => p.setSort(e.target.value)}>
                <option value="price">{t.sortPrice}</option>
                <option value="name">{t.sortName}</option>
              </select>
            </div>
          </div>
          <div className="alts" role="radiogroup" aria-label={t.s3Title}>
            {sorted.map((a) => (
              <MedicineCard key={a.medicine_id} product={a} variant="alternative" selected={p.selectedId === a.medicine_id} onSelect={() => p.onSelect(a.medicine_id)} compareTo={current.mrp?.per_unit ?? null} />
            ))}
          </div>
        </>
      )}

      {excluded.length > 0 && (
        <details className="excluded">
          <summary><Icon name="ban" size={18} /><span>{t.excludedTitle}</span><Icon name="chevronDown" size={18} className="chev" /></summary>
          <p className="muted small">{t.excludedBody}</p>
          <ul>
            {excluded.map((e) => <li key={e.reason}><span>{t.excludedReasons[e.reason]}</span><span className="count">{e.count}</span></li>)}
          </ul>
        </details>
      )}

      {alternatives.length > 0 ? (
        <ActionBar hint={!p.selectedId ? <p className="bar-hint">{t.selectHint}</p> : null}>
          <button type="button" className={`btn btn-primary ${p.selectedId ? "" : "is-blocked"}`} aria-disabled={!p.selectedId} onClick={() => p.selectedId && p.onNext()}>
            {t.viewSavings}<Icon name="arrowRight" size={18} />
          </button>
        </ActionBar>
      ) : (
        <ActionBar>
          <button type="button" className="btn btn-primary" onClick={p.onNew}><Icon name="rotate" size={20} />{t.newComparison}</button>
        </ActionBar>
      )}
    </section>
  );
}
