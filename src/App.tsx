import { STRINGS, Lang, I18nProvider } from "./i18n";
import { api } from "./api/client";
import { ComparisonResponse, Extraction, MedicineRecord, PriceType, VerificationResult } from "./domain/types";
import { extractionFromRecord } from "./domain/verification";
import { calculateSavings, comparableBases } from "./domain/pricing";
import { buildSummary, ConfirmedHow } from "./summary/buildSummary";
import { ScenarioId } from "./mock/scenarios";
import { SAMPLE_PACKS } from "./mock/strips";
import { Icon } from "./components/Icon";
import { Photo } from "./components/UploadPanel";
import { HomeScreen, Phase } from "./screens/HomeScreen";
import { VerifyScreen, canConfirm } from "./screens/VerifyScreen";
import { CompareScreen } from "./screens/CompareScreen";
import { SavingsScreen } from "./screens/SavingsScreen";
import { SummaryScreen, Downloader } from "./screens/SummaryScreen";

const { useState, useEffect, useMemo, useRef } = React;

declare global {
  interface Window { claude?: { use(name: string): Promise<any> } }
}

type Step = 1 | 2 | 3 | 4 | 5;
const MAX_BYTES = 15 * 1024 * 1024;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function storedLang(): Lang {
  try { return localStorage.getItem("dc-lang") === "hi" ? "hi" : "en"; } catch { return "en"; }
}

export function App() {
  const [lang, setLang] = useState<Lang>(storedLang);
  const t = STRINGS[lang];
  const [step, setStep] = useState<Step>(1);

  // Screen 1
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("matched");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [visionLive, setVisionLive] = useState(false);
  const [catalogue, setCatalogue] = useState<{ source: string; medicines: number } | null>(null);
  const [readBy, setReadBy] = useState<"vision" | "simulated">("simulated");
  const [manualOpen, setManualOpen] = useState(false);

  // Screen 2
  const [source, setSource] = useState<"photo" | "manual">("photo");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Extraction | null>(null);
  const [rechecking, setRechecking] = useState(false);

  // Screens 3–5
  const [confirmed, setConfirmed] = useState<{ record: MedicineRecord; how: ConfirmedHow } | null>(null);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [compState, setCompState] = useState<"loading" | "error" | "ready">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<"price" | "name">("price");
  const [unitsPerDay, setUnitsPerDay] = useState<number | null>(null);
  const [basis, setBasis] = useState<PriceType>("MRP");
  const [summaryReady, setSummaryReady] = useState(false);

  const [downloader, setDownloader] = useState<Downloader>(() => (window.claude?.use ? { kind: "pending" } : { kind: "native" }));
  const canPrint = !window.claude;
  const headRef = useRef<HTMLHeadingElement>(null);
  const pickerRef = useRef<any>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!window.claude?.use) return;
    window.claude.use("downloads").then((ns) => setDownloader(ns ? { kind: "claude", ns } : { kind: "none" }), () => setDownloader({ kind: "none" }));
  }, []);

  useEffect(() => {
    api.visionAvailable().then(setVisionLive, () => setVisionLive(false));
    api.catalogueInfo().then(setCatalogue, () => setCatalogue(null));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("dc-lang", lang); } catch {}
  }, [lang]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo({ top: 0 });
    headRef.current?.focus({ preventScroll: true });
  }, [step]);

  // ---- downstream resets: changing an earlier answer clears what depended on it
  const clearFromComparison = () => { setConfirmed(null); setComparison(null); setSelectedId(null); setUnitsPerDay(null); setBasis("MRP"); setSummaryReady(false); };

  const applyVerification = (src: "photo" | "manual", ex: Extraction, v: VerificationResult) => {
    setSource(src);
    setExtraction(ex);
    setResult(v);
    setChosenId(v.status === "needs_confirmation" && v.candidates.length === 1 ? v.candidates[0].medicine_id : null);
    setAck(false);
    setEditing(false);
    clearFromComparison();
  };

  // ---- Screen 1 actions
  const onFile = (f: File) => {
    const isImg = f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
    if (!isImg) return setFileError(t.fileErrType);
    if (f.size > MAX_BYTES) return setFileError(t.fileErrSize);
    setFileError(null);
    setIdentifyError(null);
    if (photo?.url.startsWith("blob:")) URL.revokeObjectURL(photo.url);
    setPhoto({ url: URL.createObjectURL(f), name: f.name, sample: false, file: f });
  };
  const onRemove = () => {
    if (photo?.url.startsWith("blob:")) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setIdentifyError(null);
  };
  const onSample = (s: ScenarioId) => {
    const pack = SAMPLE_PACKS[s]!;
    setFileError(null);
    setIdentifyError(null);
    setPhoto({ url: pack.img, name: pack.file, sample: true });
    setScenario(s);
  };
  /** live = send the user's own photo to OpenAI Vision; otherwise run the chosen simulated reading. */
  const identify = async (live = false) => {
    setIdentifyError(null);
    setPhase("reading");
    try {
      const useVision = live && visionLive && !!photo?.file;
      const ex = useVision ? await api.identifyWithVision(photo!.file!) : await api.identifyFromPhoto(null, scenario);
      setReadBy(useVision ? "vision" : "simulated");
      setPhase("catalogue");
      await wait(350);
      setPhase("verifying");
      const v = await api.verify(ex);
      applyVerification("photo", ex, v);
      setStep(2);
    } catch (e: any) {
      setIdentifyError(t.visionErrors[e?.message] ?? t.identifyErr);
    } finally {
      setPhase(null);
    }
  };
  const onManualPick = async (m: MedicineRecord) => {
    setPhase("verifying");
    try {
      const ex = extractionFromRecord(m);
      const v = await api.verify(ex);
      applyVerification("manual", ex, v);
      setStep(2);
    } catch {
      setIdentifyError(t.identifyErr);
    } finally {
      setPhase(null);
    }
  };

  // ---- Screen 2 actions
  const recheck = async () => {
    if (!draft) return;
    setRechecking(true);
    try {
      const v = await api.verify(draft);
      applyVerification(source, draft, v);
    } finally {
      setRechecking(false);
    }
  };
  const loadComparison = async (id: string) => {
    setCompState("loading");
    try {
      setComparison(await api.getComparison(id));
      setCompState("ready");
    } catch {
      setCompState("error");
    }
  };
  const confirm = () => {
    if (!result || !canConfirm(result, chosenId, ack)) return; // hard guard: unable can never pass
    const record = result.status === "matched" ? result.record! : result.candidates.find((c) => c.medicine_id === chosenId)!;
    const how: ConfirmedHow = source === "manual" ? "manual" : result.status !== "matched" ? "chosen" : readBy === "vision" ? "vision" : "matched";
    if (confirmed?.record.medicine_id !== record.medicine_id) {
      clearFromComparison();
      setConfirmed({ record, how });
      loadComparison(record.medicine_id);
    }
    setStep(3);
  };

  // ---- Screens 3–5 derived data
  const current = comparison?.current ?? null;
  const alt = comparison?.alternatives.find((a) => a.medicine_id === selectedId) ?? null;
  const bases = current && alt ? comparableBases(current, alt) : [];
  const effBasis: PriceType = bases.includes(basis) ? basis : "MRP";
  const outcome = useMemo(() => (current && alt ? calculateSavings(current, alt, effBasis, unitsPerDay ?? 1) : null), [current, alt, effBasis, unitsPerDay]);
  const savingsDone = !!outcome && (!outcome.ok || !!unitsPerDay);

  const reset = () => {
    onRemove();
    setFileError(null); setScenario("matched"); setManualOpen(false);
    setExtraction(null); setResult(null); setChosenId(null); setAck(false); setEditing(false);
    clearFromComparison(); setSort("price"); setStep(1);
  };

  const canVisit = (s: Step): boolean =>
    s === 1 ? phase == null
    : s === 2 ? !!result && phase == null
    : s === 3 ? !!confirmed
    : s === 4 ? !!confirmed && !!alt
    : !!confirmed && !!alt && savingsDone && summaryReady;

  const back = () => step > 1 && setStep((step - 1) as Step);

  let screen: any = null;
  if (step === 2 && result && extraction) {
    screen = (
      <VerifyScreen
        headRef={headRef} source={source} readBy={readBy} photo={photo} result={result}
        chosenId={chosenId} setChosenId={(id) => { setChosenId(id); }} ack={ack} setAck={setAck}
        editing={editing} draft={draft ?? extraction} setDraft={setDraft}
        startEdit={() => { setDraft(JSON.parse(JSON.stringify(extraction))); setEditing(true); }}
        cancelEdit={() => setEditing(false)}
        rechecking={rechecking} onRecheck={recheck} onConfirm={confirm}
        onRetake={() => { onRemove(); setManualOpen(false); setStep(1); }}
        onManual={() => { setManualOpen(true); setStep(1); }}
      />
    );
  } else if (step === 3 && confirmed) {
    screen = (
      <CompareScreen
        headRef={headRef} state={compState} data={comparison} onRetry={() => loadComparison(confirmed.record.medicine_id)}
        selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSummaryReady(false); }} sort={sort} setSort={setSort}
        onNext={() => setStep(4)} onNew={reset} catalogue={catalogue}
      />
    );
  } else if (step === 4 && current && alt && outcome) {
    screen = (
      <SavingsScreen
        headRef={headRef} current={current} alternative={alt}
        unitsPerDay={unitsPerDay} setUnitsPerDay={(n) => { setUnitsPerDay(n); setSummaryReady(false); }}
        basis={effBasis} setBasis={setBasis} bases={bases} outcome={outcome}
        onNext={() => { setSummaryReady(true); setStep(5); }} onChooseOther={() => setStep(3)}
      />
    );
  } else if (step === 5 && current && alt && comparison && confirmed) {
    const summary = buildSummary({
      current, alternatives: comparison.alternatives, selectedId, basis: effBasis,
      unitsPerDay: outcome?.ok ? unitsPerDay : null, outcome, how: confirmed.how, prepared: new Date(),
    }, t, lang);
    screen = <SummaryScreen headRef={headRef} summary={summary} downloader={downloader} canPrint={canPrint} onNew={reset} />;
  } else {
    screen = (
      <HomeScreen
        headRef={headRef} pickerRef={pickerRef} photo={photo} fileError={fileError} onFile={onFile} onRemove={onRemove}
        scenario={scenario} setScenario={setScenario} onSample={onSample} phase={phase} identifyError={identifyError} onIdentify={identify} visionLive={visionLive}
        manualOpen={manualOpen} setManualOpen={setManualOpen} onManualPick={onManualPick}
      />
    );
  }
  const shownStep: Step = screen.type === HomeScreen ? 1 : step;

  return (
    <I18nProvider value={{ t, lang }}>
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <button type="button" className="logo" onClick={reset} aria-label={`${t.brand}: ${t.newComparison}`}>
              <span className="logo-mark"><Icon name="pill" size={18} /></span>
              <span className="logo-word">Dawa<span>Compare</span></span>
            </button>
            <span className="proto-pill">{t.demoPill}</span>
            <div className="lang" role="group" aria-label={t.langLabel}>
              <button type="button" aria-pressed={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button type="button" aria-pressed={lang === "hi"} className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")} lang="hi">हिंदी</button>
            </div>
          </div>
        </header>

        <div className="layout">
          <aside className="rail">
            <nav aria-label={t.step(shownStep)}>
              <ol className="rail-steps">
                {t.steps.map((label, i) => {
                  const s = (i + 1) as Step;
                  const state = s === shownStep ? "now" : s < shownStep ? "done" : "todo";
                  return (
                    <li key={label} className={`rail-step ${state}`}>
                      <button type="button" disabled={!canVisit(s) || s === shownStep} onClick={() => setStep(s)} aria-current={s === shownStep ? "step" : undefined}>
                        <span className="rail-num">{state === "done" ? <Icon name="check" size={14} /> : s}</span>
                        <span>{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            {confirmed && shownStep >= 3 && (
              <div className="rail-card">
                <p className="med-kicker">{t.yours}</p>
                <p className="rail-med">{confirmed.record.brand_name}</p>
                <p className="muted small">{confirmed.record.active_ingredients.join(" + ")} · {confirmed.record.strength} · {t.releases[confirmed.record.release_type]}</p>
              </div>
            )}
            <p className="rail-fine">{t.disclaimer}</p>
          </aside>

          <main className="main">
            {shownStep > 1 && (
              <div className="progress">
                <button type="button" className="back" onClick={back}><Icon name="arrowLeft" size={18} />{t.back}</button>
                <span className="progress-label">{t.step(shownStep)} · {t.steps[shownStep - 1]}</span>
                <div className="progress-bar" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= shownStep ? "on" : ""} />)}</div>
              </div>
            )}
            {screen}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
