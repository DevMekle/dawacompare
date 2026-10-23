import { useI18n } from "../i18n";
import { Extraction, VerificationResult } from "../domain/types";
import { Icon } from "../components/Icon";
import { ActionBar, Notice, ScreenHead, StatusBanner, Spinner } from "../components/ui";
import { VerificationChecks, CandidatePicker, FieldEditor } from "../components/VerificationPanel";
import { Photo } from "../components/UploadPanel";

interface Props {
  headRef: any;
  source: "photo" | "manual";
  readBy: "vision" | "simulated";
  photo: Photo | null;
  result: VerificationResult;
  chosenId: string | null;
  setChosenId: (id: string) => void;
  ack: boolean;
  setAck: (v: boolean) => void;
  editing: boolean;
  draft: Extraction;
  setDraft: (d: Extraction) => void;
  startEdit: () => void;
  cancelEdit: () => void;
  rechecking: boolean;
  onRecheck: () => void;
  onConfirm: () => void;
  onRetake: () => void;
  onManual: () => void;
}

const TONE = { matched: "ok", needs_confirmation: "warn", unable: "block" } as const;
const ICON = { matched: "shieldCheck", needs_confirmation: "help", unable: "ban" } as const;

export function canConfirm(r: VerificationResult, chosenId: string | null, ack: boolean): boolean {
  if (r.status === "matched") return !!r.record;
  if (r.status === "needs_confirmation") return !!chosenId && r.candidates.some((c) => c.medicine_id === chosenId) && ack;
  return false; // "unable" can never be confirmed
}

export function VerifyScreen(p: Props) {
  const { t } = useI18n();
  const r = p.result;
  const [title, body] = t.status[r.status];
  const toCheck = r.checks.filter((c) => c.result === "unclear" || c.result === "missing").map((c) => t.fields[c.field].toLowerCase());
  const ok = canConfirm(r, p.chosenId, p.ack);

  return (
    <section className="screen">
      <ScreenHead headRef={p.headRef} title={t.s2Title} body={t.s2Body} />

      {p.rechecking ? (
        <div className="banner banner-info" role="status"><span className="banner-icon"><Spinner /></span><div className="banner-text"><strong>{t.phases.verifying}</strong></div></div>
      ) : (
        <StatusBanner tone={TONE[r.status]} icon={ICON[r.status]} title={title} body={r.status === "unable" && r.reason ? t.unableReasons[r.reason] : body} />
      )}

      <div className="source-row">
        {p.photo && p.source === "photo" && <img src={p.photo.url} alt="" />}
        <span className="muted small"><Icon name={p.source === "photo" ? "scan" : "keyboard"} size={14} />{p.source === "manual" ? t.fromManual : p.readBy === "vision" ? t.fromVision : t.fromPhoto}</span>
      </div>

      {p.editing ? (
        <div className="card">
          <FieldEditor draft={p.draft} onChange={p.setDraft} />
          <Notice tone="info" icon="pencil">{t.editedNote}</Notice>
        </div>
      ) : (
        <>
          <VerificationChecks checks={r.checks} />
          <p className="muted small read-note"><Icon name="info" size={14} />{t.readNote}</p>
        </>
      )}

      {!p.editing && r.status === "needs_confirmation" && (
        <div className="card confirm-card">
          <CandidatePicker candidates={r.candidates} checks={r.checks} value={p.chosenId} onChange={p.setChosenId} />
          {toCheck.length > 0 && (
            <label className="check">
              <input type="checkbox" id="ack" checked={p.ack} onChange={(e: any) => p.setAck(e.target.checked)} />
              <span>{t.ackLabel(toCheck.join(", "))}</span>
            </label>
          )}
        </div>
      )}

      <ActionBar
        hint={
          !p.editing && r.status === "unable" ? <p className="bar-hint">{t.blockedHint}</p>
          : !p.editing && r.status === "needs_confirmation" && !ok ? <p className="bar-hint">{t.pickHint}</p>
          : null
        }
      >
        {p.editing ? (
          <button type="button" className="btn btn-primary" onClick={p.onRecheck} disabled={p.rechecking}><Icon name="shieldCheck" size={20} />{t.checkAgain}</button>
        ) : r.status === "unable" ? (
          p.source === "photo"
            ? <button type="button" className="btn btn-primary" onClick={p.onRetake}><Icon name="camera" size={20} />{t.retakeCta}</button>
            : <button type="button" className="btn btn-primary" onClick={p.onManual}><Icon name="search" size={20} />{t.manualCta}</button>
        ) : (
          <button type="button" className={`btn btn-primary ${ok ? "" : "is-blocked"}`} aria-disabled={!ok} onClick={() => ok && p.onConfirm()}>
            <Icon name="circleCheck" size={20} />{t.confirmCta}
          </button>
        )}
      </ActionBar>

      <div className="secondary-row">
        {p.editing ? (
          <button type="button" className="btn btn-quiet" onClick={p.cancelEdit}><Icon name="x" size={16} />{t.cancelEdit}</button>
        ) : (
          <>
            <button type="button" className="btn btn-quiet" onClick={p.startEdit}><Icon name="pencil" size={16} />{t.correct}</button>
            {r.status === "unable" && p.source === "photo" && <button type="button" className="btn btn-quiet" onClick={p.onManual}><Icon name="keyboard" size={16} />{t.manualCta}</button>}
          </>
        )}
      </div>
    </section>
  );
}
