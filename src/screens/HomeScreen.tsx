import { useI18n, withAi } from "../i18n";
import { MedicineRecord } from "../domain/types";
import { ScenarioId } from "../mock/scenarios";
import { SAMPLE_PACKS } from "../mock/strips";
import { Icon } from "../components/Icon";
import { ActionBar, Notice, Spinner } from "../components/ui";
import { UploadPanel, Photo } from "../components/UploadPanel";
import { ManualSearch } from "../components/ManualSearch";

export type Phase = "reading" | "catalogue" | "verifying";
const PHASES: Phase[] = ["reading", "catalogue", "verifying"];
const PHASE_ICON: Record<Phase, string> = { reading: "scan", catalogue: "database", verifying: "shieldCheck" };

interface Props {
  headRef: any;
  pickerRef: any;
  photo: Photo | null;
  fileError: string | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  scenario: ScenarioId;
  setScenario: (s: ScenarioId) => void;
  onSample: (s: ScenarioId) => void;
  phase: Phase | null;
  identifyError: string | null;
  onIdentify: (live?: boolean) => void;
  /** Display name of the live vision service, or null when photo reading isn't available. */
  aiName: string | null;
  manualOpen: boolean;
  setManualOpen: (v: boolean) => void;
  onManualPick: (m: MedicineRecord) => void;
}

export function HomeScreen(p: Props) {
  const { t } = useI18n();
  const busy = p.phase != null;
  const upload = !!p.photo && !p.photo.sample;
  const live = upload && !!p.aiName;
  const sample = !!p.photo && p.photo.sample;
  const simPicker = (
    <div className="sim">
      <label htmlFor="sim-scenario" className="sim-title"><Icon name="info" size={16} />{t.simTitle}</label>
      <select id="sim-scenario" className="input" value={p.scenario} onChange={(e: any) => p.setScenario(e.target.value)}>
        {(Object.keys(t.scenarioNames) as ScenarioId[]).map((k) => <option key={k} value={k}>{t.scenarioNames[k]}</option>)}
      </select>
      <p className="field-hint">{upload ? t.demoSimWarn : t.simHelp}</p>
    </div>
  );

  return (
    <section className="screen">
      <div className="hero">
        <p className="eyebrow">{t.s1Eyebrow}</p>
        <h1 ref={p.headRef} tabIndex={-1} className="hero-title">{t.s1Title}</h1>
        <p className="lede">{t.s1Body}</p>
        <ul className="hero-points">
          <li><Icon name="check" size={16} />{t.noSignup}</li>
          <li><Icon name="check" size={16} />{t.sameFormulation}</li>
        </ul>
      </div>

      {busy ? (
        <div className="pipeline" role="status" aria-live="polite">
          {p.photo && <img src={p.photo.url} alt="" className="pipeline-thumb" />}
          <ol>
            {PHASES.map((ph) => {
              const i = PHASES.indexOf(ph), cur = PHASES.indexOf(p.phase!);
              const state = i < cur ? "done" : i === cur ? "now" : "todo";
              return (
                <li key={ph} className={`ph ph-${state}`}>
                  <span className="ph-icon">{state === "done" ? <Icon name="check" size={16} /> : state === "now" ? <Spinner /> : <Icon name={PHASE_ICON[ph]} size={16} />}</span>
                  {ph === "reading" && live ? withAi(t.readingLive, p.aiName) : t.phases[ph]}
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <UploadPanel photo={p.photo} error={p.fileError} onFile={p.onFile} onRemove={p.onRemove} pickerRef={p.pickerRef} />
      )}

      {p.identifyError && !busy && (
        <Notice tone="block" icon="alert" role="alert">{p.identifyError}</Notice>
      )}

      {upload && !live && !busy && (
        <>
          <Notice tone="info" icon="info"><strong>{t.noVisionTitle}</strong><br />{t.noVisionBody}</Notice>
          <details className="sim-details">
            <summary><Icon name="scan" size={16} /><span>{t.demoSimToggle}</span><Icon name="chevronDown" size={16} className="chev" /></summary>
            {simPicker}
            <button type="button" className="btn btn-secondary" onClick={() => p.onIdentify(false)}><Icon name="scan" size={18} />{t.simulateCta}</button>
          </details>
        </>
      )}

      {sample && !busy && simPicker}

      {!busy && (
        <ActionBar>
          {live ? (
            <button type="button" className="btn btn-primary" onClick={() => p.onIdentify(true)}><Icon name="scan" size={20} />{p.identifyError ? t.tryAgain : t.identifyCta}</button>
          ) : upload ? (
            <button type="button" className="btn btn-primary" onClick={() => { p.setManualOpen(true); setTimeout(() => document.getElementById("manual-q")?.focus(), 50); }}><Icon name="keyboard" size={20} />{t.typeNameCta}</button>
          ) : p.photo ? (
            <button type="button" className="btn btn-primary" onClick={() => p.onIdentify(false)}><Icon name="scan" size={20} />{p.identifyError ? t.tryAgain : t.identifyCta}</button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => p.pickerRef.current?.file()}><Icon name="upload" size={20} />{t.uploadCta}</button>
              <button type="button" className="btn btn-secondary btn-cam" onClick={() => p.pickerRef.current?.camera()} aria-label={t.cameraCta}><Icon name="camera" size={20} /><span className="cam-label">{t.cameraCta}</span></button>
            </>
          )}
        </ActionBar>
      )}

      {!busy && (
        <div className="alt-entry">
          <button type="button" className="link-btn" aria-expanded={p.manualOpen} aria-controls="manual-panel" onClick={() => p.setManualOpen(!p.manualOpen)}>
            <Icon name="keyboard" size={18} />{t.manualToggle}<Icon name="chevronDown" size={16} className={p.manualOpen ? "rot" : ""} />
          </button>
          {p.manualOpen && <div id="manual-panel"><ManualSearch onPick={p.onManualPick} autoFocus /></div>}

          <p className="alt-label">{t.samplesTitle}</p>
          <div className="samples">
            {(["matched", "ambiguous_release", "strength_mismatch"] as ScenarioId[]).map((k) => (
              <button key={k} type="button" className="sample" onClick={() => p.onSample(k)}>
                <img src={SAMPLE_PACKS[k]!.img} alt="" />
                <span><strong>{t.samples[k][0]}</strong><small>{t.samples[k][1]}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="how">
        <summary><Icon name="listChecks" size={18} /><span>{t.howTitle}</span><Icon name="chevronDown" size={18} className="chev" /></summary>
        <ol className="how-steps">
          {t.howSteps.map(([h, b], i) => (
            <li key={h}><span className="how-n">{i + 1}</span><div><strong>{h}</strong><p>{b}</p></div></li>
          ))}
        </ol>
      </details>

      <div className="fineprint">
        <p className="privacy"><Icon name="lock" size={16} />{p.aiName ? withAi(t.privacyLive, p.aiName) : t.privacy}</p>
        <p className="disclaimer">{t.disclaimer}</p>
      </div>
    </section>
  );
}
