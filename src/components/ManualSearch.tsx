import { MedicineRecord } from "../domain/types";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

const { useState, useEffect } = React;

/** Manual fallback: search the catalogue by brand or salt name and pick a product. */
export function ManualSearch({ onPick, autoFocus }: { onPick: (m: MedicineRecord) => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MedicineRecord[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    const id = setTimeout(() => {
      api.searchCatalogue(query).then((r) => { if (live) { setResults(r); setLoading(false); } }, () => live && setLoading(false));
    }, 200);
    return () => { live = false; clearTimeout(id); };
  }, [q]);

  return (
    <div className="manual">
      <label htmlFor="manual-q" className="field-label">{t.manualLabel}</label>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input id="manual-q" className="input" type="search" autoComplete="off" placeholder={t.manualPlaceholder} value={q} onChange={(e: any) => setQ(e.target.value)} autoFocus={autoFocus} />
      </div>
      <p className="field-hint">{t.manualHint}</p>
      <div aria-live="polite">
        {loading && <p className="muted small search-status"><Spinner />{t.manualSearching}</p>}
        {!loading && results && results.length === 0 && <p className="search-empty">{t.manualNone(q.trim())}</p>}
        {!loading && results && results.length > 0 && (
          <ul className="results">
            {results.map((m) => (
              <li key={m.medicine_id}>
                <button type="button" className="result" onClick={() => onPick(m)}>
                  <span className="result-main">
                    <strong>{m.brand_name}</strong>
                    <span className="muted small">{m.active_ingredients.join(" + ")} · {m.strength} · {t.releases[m.release_type]}</span>
                  </span>
                  <span className="result-cta">{t.manualPick}<Icon name="arrowRight" size={16} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
