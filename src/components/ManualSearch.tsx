import { MedicineRecord } from "../domain/types";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { DEMO } from "../lib/mode";

const { useState, useEffect } = React;

interface Props {
  onPick: (m: MedicineRecord) => void;
  autoFocus?: boolean;
  /** Set when AI identification is available: identifies a name that isn't in the catalogue. Rejects with Error(code). */
  onIdentifyName?: (name: string) => Promise<void>;
}

/** Search the catalogue by brand or salt name. A name that isn't listed is identified by AI. */
export function ManualSearch({ onPick, autoFocus, onIdentifyName }: Props) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MedicineRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [idState, setIdState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const name = q.trim();
  const canIdentify = !!onIdentifyName && !loading && !!results && results.length === 0 && name.length >= 2;
  const identify = async () => {
    if (!canIdentify || idState.busy) return;
    setIdState({ busy: true, error: null });
    try {
      await onIdentifyName!(name);
      setIdState({ busy: false, error: null });
    } catch (e: any) {
      const code = e?.message;
      setIdState({ busy: false, error: code === "not_recognised" || code === "not_medicine" ? t.nameNotFound(name) : t.visionErrors[code] ?? t.nameFailed });
    }
  };

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
        <input id="manual-q" className="input" type="search" autoComplete="off" placeholder={t.manualPlaceholder} value={q} onChange={(e: any) => { setQ(e.target.value); setIdState({ busy: false, error: null }); }} onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); identify(); } }} autoFocus={autoFocus} />
      </div>
      <p className="field-hint">{t.manualHint}</p>
      <div aria-live="polite">
        {loading && <p className="muted small search-status"><Spinner />{t.manualSearching}</p>}
        {!loading && results && results.length === 0 && (
          onIdentifyName ? (
            <div className="search-empty search-identify">
              <p>{t.manualNoneLive(name)}</p>
              <button type="button" className="btn btn-primary" onClick={identify} disabled={idState.busy}>
                {idState.busy ? <><Spinner />{t.identifyingName}</> : <><Icon name="scan" size={18} />{t.identifyName(name)}</>}
              </button>
              {idState.error && <p className="search-id-error" role="alert">{idState.error}</p>}
            </div>
          ) : <p className="search-empty">{DEMO ? t.manualNone(name) : t.manualNoneOffline(name)}</p>
        )}
        {!loading && results && results.length > 0 && (
          <ul className="results">
            {results.map((m) => (
              <li key={m.medicine_id}>
                <button type="button" className="result" onClick={() => onPick(m)}>
                  <span className="result-main">
                    <strong>{m.brand_name}</strong>
                    <span className="muted small">{m.active_ingredients.join(" + ")} · {m.strength}</span>
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
