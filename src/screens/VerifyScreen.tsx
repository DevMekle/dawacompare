import { useI18n, withAi } from "../i18n";
import { Extraction, Formulation, ReleaseType, VerificationResult } from "../domain/types";

const { useState } = React;
import { Icon } from "../components/Icon";
import { ActionBar, Notice, ScreenHead, StatusBanner, Spinner } from "../components/ui";
import { VerificationChecks, CandidatePicker, FieldEditor } from "../components/VerificationPanel";
import { Photo } from "../components/UploadPanel";

interface Props {
  headRef: any;
  source: "photo" | "manual";
  readBy: "vision" | "simulated";
  aiName: string | null;
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
  /** Brand not listed but the formulation is: compare using the price on the customer's pack. */
  onCompareByPack: (f: Formulation, mrp: number, pack: number) => void;
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

  // Compare by salt (brand not in catalogue, formulation is)
  const matches = r.status === "unable" && r.reason === "no_record" ? r.formulation_matches ?? [] : [];
  const releaseOptions = Array.from(new Set(matches.map((m) => m.release_type))) as ReleaseType[];
  const [packRelease, setPackRelease] = useState<ReleaseType | null>(releaseOptions.length === 1 ? releaseOptions[0] : null);
  const [packMrp, setPackMrp] = useState("");
  const [packQty, setPackQty] = useState("");
  const [packAck, setPackAck] = useState(false);
  const mrpN = parseFloat(packMrp), qtyN = parseInt(packQty, 10);
  const packOk = matches.length > 0 && !!packRelease && mrpN > 0 && mrpN <= 100000 && qtyN >= 1 && qtyN <= 1000 && packAck;
  const comparePack = () => {
    if (!packOk) return;
    const m = matches.find((x) => x.release_type === packRelease)!;
    p.onCompareByPack({ active_ingredients: m.active_ingredients, strength: m.strength, dosage_form: m.dosage_form, release_type: packRelease! }, Math.round(mrpN * 100) / 100, qtyN);
  };

  return (
    <section className="screen">
      <ScreenHead headRef={p.headRef} title={t.s2Title} body={t.s2Body} />

      {p.rechecking ? (
        <div className="banner banner-info" role="status"><span className="banner-icon"><Spinner /></span><div className="banner-text"><strong>{t.phases.verifying}</strong></div></div>
      ) : (
        matches.length > 0
          ? <StatusBanner tone="warn" icon="help" title={t.packBannerTitle} body={t.packBannerBody} />
          : <StatusBanner tone={TONE[r.status]} icon={ICON[r.status]} title={title} body={r.status === "unable" && r.reason ? t.unableReasons[r.reason] : body} />
      )}

      {!p.editing && matches.length > 0 && (
        <div className="card pack-card">
          <h2>{t.packTitle}</h2>
          <p>{t.packBody}</p>
          <p className="facts"><span className="fact">{matches[0].active_ingredients.join(" + ")} · {matches[0].strength}</span><span className="fact">{t.forms[matches[0].dosage_form]}</span></p>
          <div>
            <span className="field-label" id="pack-rel-label">{t.packRelease}</span>
            <div className="pick-list" role="radiogroup" aria-labelledby="pack-rel-label">
              {releaseOptions.map((rt) => (
                <label key={rt} className={`pick-item ${packRelease === rt ? "on" : ""}`}>
                  <input type="radio" name="pack-release" id={`pack-rel-${rt}`} checked={packRelease === rt} onChange={() => setPackRelease(rt)} />
                  <span className="pick-body"><strong>{t.releases[rt]}</strong></span>
                </label>
              ))}
            </div>
          </div>
          <div className="pack-grid">
            <div><label htmlFor="pack-mrp">{t.packMrp}</label><input id="pack-mrp" className="input" type="number" inputMode="decimal" min={0.01} step={0.01} value={packMrp} onChange={(e: any) => setPackMrp(e.target.value)} /></div>
            <div><label htmlFor="pack-qty">{t.packQty}</label><input id="pack-qty" className="input" type="number" inputMode="numeric" min={1} step={1} value={packQty} onChange={(e: any) => setPackQty(e.target.value)} /></div>
          </div>
          <label className="check">
            <input type="checkbox" id="pack-ack" checked={packAck} onChange={(e: any) => setPackAck(e.target.checked)} />
            <span>{t.packAck}</span>
          </label>
        </div>
      )}

      <div className="source-row">
        {p.photo && p.source === "photo" && <img src={p.photo.url} alt="" />}
        <span className="muted small"><Icon name={p.source === "photo" ? "scan" : "keyboard"} size={14} />{p.source === "manual" ? t.fromManual : p.readBy === "vision" ? withAi(t.fromVision, p.aiName) : t.fromPhoto}</span>
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
          !p.editing && matches.length > 0 && !packOk ? <p className="bar-hint">{t.packNeed}</p>
          : !p.editing && r.status === "unable" && matches.length === 0 ? <p className="bar-hint">{t.blockedHint}</p>
          : !p.editing && r.status === "needs_confirmation" && !ok ? <p className="bar-hint">{t.pickHint}</p>
          : null
        }
      >
        {p.editing ? (
          <button type="button" className="btn btn-primary" onClick={p.onRecheck} disabled={p.rechecking}><Icon name="shieldCheck" size={20} />{t.checkAgain}</button>
        ) : matches.length > 0 ? (
          <button type="button" className={`btn btn-primary ${packOk ? "" : "is-blocked"}`} aria-disabled={!packOk} onClick={comparePack}><Icon name="arrowRight" size={20} />{t.packCta}</button>
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
            {matches.length > 0 && p.source === "photo" && <button type="button" className="btn btn-quiet" onClick={p.onRetake}><Icon name="camera" size={16} />{t.retakeCta}</button>}
            {r.status === "unable" && p.source === "photo" && <button type="button" className="btn btn-quiet" onClick={p.onManual}><Icon name="keyboard" size={16} />{t.manualCta}</button>}
          </>
        )}
      </div>
    </section>
  );
}
