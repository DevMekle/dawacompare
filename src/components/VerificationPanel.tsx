import { CheckResult, Extraction, FieldCheck, FieldKey, MedicineRecord, CRITICAL_FIELDS } from "../domain/types";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Chip } from "./ui";

const RESULT_ICON: Record<CheckResult, string> = { match: "circleCheck", unclear: "help", missing: "help", mismatch: "circleX", no_record: "searchX" };
const RESULT_TONE: Record<CheckResult, "ok" | "warn" | "block"> = { match: "ok", unclear: "warn", missing: "warn", mismatch: "block", no_record: "block" };

/** Display value for a field (release/form codes become words). */
export function useFieldText() {
  const { t } = useI18n();
  return (field: FieldKey, v: string | null) => {
    if (v == null) return "—";
    if (field === "release_type") return v.split(" / ").map((x) => t.releases[x] ?? x).join(" / ");
    if (field === "dosage_form") return v.split(" / ").map((x) => t.forms[x] ?? x).join(" / ");
    return v;
  };
}

/** Field-by-field checks: what was read, what the catalogue says, and the result. */
export function VerificationChecks({ checks }: { checks: FieldCheck[] }) {
  const { t } = useI18n();
  const text = useFieldText();
  return (
    <div className="checks" role="table" aria-label={t.colResult}>
      <div className="checks-head" role="row">
        <span role="columnheader">{t.colField}</span>
        <span role="columnheader">{t.colRead}</span>
        <span role="columnheader">{t.colCatalogue}</span>
        <span role="columnheader">{t.colResult}</span>
      </div>
      {checks.filter((c) => c.field !== "release_type" || c.result === "mismatch").map((c) => (
        <div key={c.field} className={`check-row is-${c.result === "no_record" && c.field !== "brand_name" ? "neutral" : c.result}`} role="row">
          <span className="check-field" role="rowheader">{t.fields[c.field]}</span>
          <span className="check-read" role="cell">
            <span className="check-k">{t.colRead}</span>
            <span className={c.extracted ? "" : "muted"}>{text(c.field, c.extracted)}</span>
            <Chip tone={c.read === "clear" ? "mute" : c.read === "user" ? "user" : "warn"}>{t.reads[c.read]}</Chip>
          </span>
          <span className="check-cat" role="cell">
            <span className="check-k">{t.colCatalogue}</span>
            {text(c.field, c.catalogue)}
          </span>
          {c.result === "no_record" && c.field !== "brand_name" ? (
            <span className="check-res muted" role="cell">—</span>
          ) : (
            <span className={`check-res tone-${RESULT_TONE[c.result]}`} role="cell">
              <Icon name={RESULT_ICON[c.result]} size={16} />
              {t.results[c.result]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Lets the user pick which catalogue product is on the pack when more than one fits. */
export function CandidatePicker({ candidates, checks, value, onChange }: { candidates: MedicineRecord[]; checks: FieldCheck[]; value: string | null; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const differing = new Set(checks.filter((c) => c.catalogue?.includes(" / ")).map((c) => c.field));
  return (
    <fieldset className="pick">
      <legend>{t.chooseTitle}</legend>
      {candidates.length > 1 && <p className="muted small">{t.chooseHelp}</p>}
      <div className="pick-list">
        {candidates.map((m) => (
          <label key={m.medicine_id} className={`pick-item ${value === m.medicine_id ? "on" : ""}`}>
            <input type="radio" name="candidate" id={`cand-${m.medicine_id}`} checked={value === m.medicine_id} onChange={() => onChange(m.medicine_id)} />
            <span className="pick-body">
              <strong>{m.brand_name}</strong>
              <span className="pick-facts">
                {differing.has("release_type") && <span className="hl">{t.releases[m.release_type]}</span>}
                <span className={differing.has("strength") ? "hl" : ""}>{m.strength}</span>
                <span>{m.active_ingredients.join(" + ")}</span>
                {m.manufacturer && <span className="muted">{m.manufacturer}</span>}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Edit form for correcting what was read. Values feed a fresh verification run. */
export function FieldEditor({ draft, onChange }: { draft: Extraction; onChange: (d: Extraction) => void }) {
  const { t } = useI18n();
  const set = (f: FieldKey, v: string) => onChange({ ...draft, [f]: { value: v || null, read: v ? "user" : "not_found" } });
  return (
    <div className="editor">
      {CRITICAL_FIELDS.filter((f) => f !== "release_type" || !!draft.release_type.value).map((f) => (
        <div className="ed-field" key={f}>
          <label htmlFor={`ed-${f}`}>{t.fields[f]}</label>
          {f === "dosage_form" ? (
            <select id={`ed-${f}`} className="input" value={draft[f].value ?? ""} onChange={(e: any) => set(f, e.target.value)}>
              <option value="">{t.choose}</option>
              {["Tablet", "Capsule"].map((v) => <option key={v} value={v}>{t.forms[v]}</option>)}
            </select>
          ) : f === "release_type" ? (
            <select id={`ed-${f}`} className="input" value={draft[f].value ?? ""} onChange={(e: any) => set(f, e.target.value)}>
              <option value="">{t.choose}</option>
              {["IR", "SR", "ER", "MR", "DR"].map((v) => <option key={v} value={v}>{t.releases[v]}</option>)}
            </select>
          ) : (
            <input id={`ed-${f}`} className="input" value={draft[f].value ?? ""} autoComplete="off" onChange={(e: any) => set(f, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}
