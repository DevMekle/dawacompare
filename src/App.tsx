import { STRINGS, Lang, I18nProvider, AI_NAMES } from "./i18n";
import { api } from "./api/client";
import { ComparableProduct, ComparisonResponse, Extraction, Formulation, MedicineRecord, PriceQuote, PriceType, VerificationResult } from "./domain/types";
import { DEMO } from "./lib/mode";
import { inr, fmtNum } from "./lib/format";
import { SavedMed, loadSaved, storeSaved } from "./lib/savedMeds";
import { extractionFromRecord } from "./domain/verification";
import { isSaltName } from "./domain/normalize";
import { calculateSavings, comparableBases } from "./domain/pricing";
import { buildSummary, ConfirmedHow } from "./summary/buildSummary";
import { ScenarioId } from "./mock/scenarios";
import { SAMPLE_PACKS } from "./mock/strips";
import { Icon } from "./components/Icon";
import { Spinner } from "./components/ui";
import { Photo } from "./components/UploadPanel";
import { HomeScreen, Phase } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { AccountScreen, AlertList } from "./screens/AccountScreen";
import { accountApi, Alert, CloudSaved, Me } from "./api/account";
import { VerifyScreen, canConfirm } from "./screens/VerifyScreen";
import { ResultScreen, Downloader } from "./screens/ResultScreen";

const { useState, useEffect, useMemo, useRef } = React;

declare global {
  interface Window { claude?: { use(name: string): Promise<any> } }
}

type Step = 1 | 2 | 3 | 4;
/** The live site requires sign-in. Demo mode (artifact, local file, ?demo) has no backend and skips it. */
const LIVE = !DEMO && typeof location !== "undefined" && /^https?:$/.test(location.protocol);
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
  const [visionProvider, setVisionProvider] = useState<string | null>(null);
  const visionLive = !!visionProvider;
  const aiName = visionProvider ? AI_NAMES[visionProvider] ?? visionProvider : null;
  const [catalogue, setCatalogue] = useState<{ source: string; medicines: number } | null>(null);
  const [readBy, setReadBy] = useState<"vision" | "simulated">("simulated");
  const [manualOpen, setManualOpen] = useState(false);

  // Screen 2
  const [source, setSource] = useState<"photo" | "manual" | "name">("photo");
  /** What was identified beyond the checked fields: the company, and how it was identified. */
  const [maker, setMaker] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Extraction | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [verifyKey, setVerifyKey] = useState(0);

  // Screens 3–5
  const [confirmed, setConfirmed] = useState<{ record: MedicineRecord; how: ConfirmedHow } | null>(null);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [compState, setCompState] = useState<"loading" | "error" | "ready">("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<"price" | "name">("price");
  const [unitsPerDay, setUnitsPerDay] = useState<number | null>(null);
  const [basis, setBasis] = useState<PriceType>("MRP");
  const [packInfo, setPackInfo] = useState<{ f: Formulation; mrp: number; pack: number; brand: string } | null>(null);
  const [saved, setSaved] = useState<SavedMed[]>(loadSaved);
  // Accounts: "loading" while checking the session, "out" signed out, "na" when sign-in isn't available here.
  const [auth, setAuth] = useState<Me | "loading" | "out" | "na">(LIVE ? "loading" : "na");
  const user = typeof auth === "object" ? auth : null;
  const plus = user?.plan === "plus";
  const [cloud, setCloud] = useState<CloudSaved[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [view, setView] = useState<"app" | "account" | "plans">("app");
  // Sign-in is asked for only when a comparison starts; the action then continues after sign-in.
  const [pending, setPending] = useState<null | { run: () => void }>(null);
  const needLogin = LIVE && auth === "out";
  const guard = (run: () => void) => { if (needLogin) setPending({ run }); else run(); };
  const [checks, setChecks] = useState<number | null>(null);

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
    api.visionAvailable().then(setVisionProvider, () => setVisionProvider(null));
    api.catalogueInfo().then(setCatalogue, () => setCatalogue(null));
    api.usageStats().then((s) => setChecks(s?.checks ?? null), () => setChecks(null));
    if (LIVE) accountApi.me().then((r) => setAuth(r === null ? "out" : r === "unavailable" ? "na" : r.user), () => setAuth("na"));
  }, []);

  useEffect(() => {
    if (!plus) { setCloud([]); setAlerts([]); return; }
    accountApi.saved().then((r) => setCloud(r.saved), () => setCloud([]));
  }, [plus, user?.phone]);
  useEffect(() => {
    if (!plus) return;
    accountApi.alerts().then((r) => setAlerts(r.alerts), () => setAlerts([]));
  }, [plus, cloud]);

  /** Anonymous usage event (no personal data); ignored when there's no backend. */
  const track = (name: string, meta?: Record<string, unknown>) => { api.sendFeedback({ kind: "event", name, meta }); };

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
  // Nothing is preselected: the customer chooses the alternative and enters tablets a day.
  const clearFromComparison = () => { setConfirmed(null); setComparison(null); setSelectedId(null); setUnitsPerDay(null); setBasis("MRP"); };

  const applyVerification = (src: "photo" | "manual" | "name", ex: Extraction, v: VerificationResult) => {
    setSource(src);
    setExtraction(ex);
    setResult(v);
    setChosenId(v.status === "needs_confirmation" && v.candidates.length === 1 ? v.candidates[0].medicine_id : null);
    setAck(false);
    setEditing(false);
    setVerifyKey((k) => k + 1);
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
      const out = useVision ? await api.identifyWithVision(photo!.file!) : { extraction: await api.identifyFromPhoto(null, scenario), maker: null };
      const ex = out.extraction;
      setReadBy(useVision ? "vision" : "simulated");
      setMaker(out.maker);
      setPhase("catalogue");
      await wait(350);
      setPhase("verifying");
      const v = await api.verify(ex);
      applyVerification("photo", ex, v);
      setStep(2);
    } catch (e: any) {
      setIdentifyError(t.visionErrors[e?.message] ?? t.identifyErr);
      if (e?.message === "vision_failed") setManualOpen(true);
    } finally {
      setPhase(null);
    }
  };
  const onManualPick = async (m: MedicineRecord) => {
    setPhase("verifying");
    try {
      const ex = extractionFromRecord(m);
      const v = await api.verify(ex);
      setMaker(m.manufacturer);
      applyVerification("manual", ex, v);
      setStep(2);
    } catch {
      setIdentifyError(t.identifyErr);
    } finally {
      setPhase(null);
    }
  };

  /** A typed name that isn't in the catalogue: AI identifies it, then the Verification Layer runs as for a photo. */
  const identifyName = async (name: string) => {
    const out = await api.identifyByName(name);
    const v = await api.verify(out.extraction);
    setReadBy("vision");
    setMaker(out.maker);
    applyVerification("name", out.extraction, v);
    setStep(2);
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
      const c = await api.getComparison(id);
      setComparison(c);
      setCompState("ready");
      track("comparison_viewed", { medicine: c.current.brand_name, alternatives: c.alternatives.length });
    } catch {
      setCompState("error");
    }
  };

  /** Brand not listed: compare the formulation the customer confirmed, priced from their own pack. */
  const compareByPack = async (f: Formulation, mrp: number, pack: number, brandName?: string) => {
    const read = extraction?.brand_name.value ?? null;
    const generic = isSaltName(read, extraction?.active_ingredients.value ?? null);
    const brand = brandName || (read && !generic ? read : t.genericName(f.active_ingredients.join(" + "), f.strength));
    const today = new Date().toISOString().slice(0, 10);
    const record: MedicineRecord = { medicine_id: "user_pack", brand_name: brand, manufacturer: brandName ? null : maker, ...f, verification_status: "verified", review_status: "pending" };
    const quote: PriceQuote = { price_type: "MRP", amount: mrp, pack_quantity: pack, price_source: "user_pack", verification_status: "verified", last_verified_at: today, freshness: "current", per_unit: mrp / pack };
    const currentP: ComparableProduct = { ...record, mrp: quote, actual_selling_price: null, pack_quantity: pack, price_source: "user_pack", last_verified_at: today };
    clearFromComparison();
    setConfirmed({ record, how: "pack" });
    setPackInfo({ f, mrp, pack, brand });
    setCompState("loading");
    setStep(3);
    try {
      const r = await api.getFormulationComparison(f);
      setComparison({ current: currentP, ...r });
      setCompState("ready");
      track("comparison_viewed", { medicine: "pack:" + f.active_ingredients.join("+") + " " + f.strength, alternatives: r.alternatives.length });
    } catch {
      setCompState("error");
    }
  };

  const recheckSaved = (m: SavedMed) => {
    if (m.kind === "pack" && m.formulation && m.mrp && m.pack) return compareByPack(m.formulation, m.mrp, m.pack, m.brand);
    if (m.record) {
      clearFromComparison();
      setConfirmed({ record: m.record, how: "manual" });
      loadComparison(m.record.medicine_id);
      setStep(3);
    }
  };
  const removeSaved = (key: string) => {
    if (key.startsWith("cloud:")) { accountApi.unsave(Number(key.slice(6))).then((r) => setCloud(r.saved), () => {}); return; }
    const next = saved.filter((x) => x.key !== key); setSaved(next); storeSaved(next);
  };
  /** Plus: medicines come from the account (all devices), labelled with the family member. */
  const homeSaved: SavedMed[] = plus
    ? cloud.map((c) => ({ ...(c.data as SavedMed), key: `cloud:${c.id}`, profileName: user!.profiles.find((p) => p.id === c.profile_id)?.name }))
    : saved;
  const signOut = () => { setAuth("out"); setCloud([]); setAlerts([]); setView("app"); reset(); };
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

  const reset = () => {
    onRemove();
    setFileError(null); setScenario("matched"); setManualOpen(false);
    setExtraction(null); setResult(null); setChosenId(null); setAck(false); setEditing(false); setMaker(null);
    clearFromComparison(); setPackInfo(null); setSort("price"); setStep(1);
  };

  const canVisit = (s: Step): boolean =>
    s === 1 ? phase == null
    : s === 2 ? !!result && phase == null
    : s === 3 ? !!confirmed
    : !!confirmed && !!alt;

  const back = () => step > 1 && setStep((step - 1) as Step);

  let screen: any = null;
  if (step === 2 && result && extraction) {
    screen = (
      <VerifyScreen
        key={verifyKey}
        headRef={headRef} source={source} readBy={readBy} aiName={aiName} photo={photo} result={result} extraction={extraction} maker={maker} onNew={reset}
        chosenId={chosenId} setChosenId={(id) => { setChosenId(id); }} ack={ack} setAck={setAck}
        editing={editing} draft={draft ?? extraction} setDraft={setDraft}
        startEdit={() => { setDraft(JSON.parse(JSON.stringify(extraction))); setEditing(true); }}
        cancelEdit={() => setEditing(false)}
        rechecking={rechecking} onRecheck={recheck} onConfirm={confirm}
        onRetake={() => { onRemove(); setManualOpen(false); setStep(1); }}
        onManual={() => { setManualOpen(true); setStep(1); }}
        onCompareByPack={compareByPack}
      />
    );
  } else if ((step === 3 || step === 4) && confirmed) {
    const units = outcome?.ok ? unitsPerDay : null;
    const summary = current && alt && comparison && outcome && units ? buildSummary({
      current, alternatives: comparison.alternatives, selectedId, basis: effBasis,
      unitsPerDay: units, outcome, how: confirmed.how, prepared: new Date(), aiName, demo: DEMO,
    }, t, lang) : null;
    const monthly = outcome?.ok && outcome.monthlySaving > 0 ? outcome.monthlySaving : null;
    const savingText = outcome?.ok && monthly ? `${inr(outcome.monthlySaving)}/month (${inr(outcome.annualSaving)}/year)` : null;
    // The WhatsApp message carries the working, so the screen can stay simple.
    const calc = outcome?.ok && current && alt && units ? [
      `${current.brand_name}: ${t.normLine(inr(outcome.current.amount, true), outcome.current.pack_quantity, inr(outcome.current.per_unit, true))}`,
      `${alt.brand_name}: ${t.normLine(inr(outcome.alternative.amount, true), outcome.alternative.pack_quantity, inr(outcome.alternative.per_unit, true))}`,
      `${fmtNum(units)} × 30 × ${inr(outcome.current.per_unit, true)} = ${inr(outcome.current.monthly)} → ${fmtNum(units)} × 30 × ${inr(outcome.alternative.per_unit, true)} = ${inr(outcome.alternative.monthly)}`,
    ].join("\n") : null;
    const siteUrl = DEMO ? "" : location.origin;
    const savedKey = confirmed.record.medicine_id === "user_pack" && packInfo ? `pack:${packInfo.f.active_ingredients.join("+")}:${packInfo.f.strength}:${packInfo.f.release_type}` : confirmed.record.medicine_id;
    const isSaved = (profileId?: number) => plus ? cloud.some((c) => c.key === savedKey && c.profile_id === profileId) : saved.some((x) => x.key === savedKey);
    const onSave = (profileId?: number) => {
      if (!alt) return;
      const entry: SavedMed = confirmed.record.medicine_id === "user_pack" && packInfo
        ? { key: savedKey, kind: "pack", brand: packInfo.brand, formulation: packInfo.f, mrp: packInfo.mrp, pack: packInfo.pack, altName: alt.brand_name, monthlySaving: monthly, savedAt: new Date().toISOString() }
        : { key: savedKey, kind: "catalogue", brand: confirmed.record.brand_name, record: confirmed.record, altName: alt.brand_name, monthlySaving: monthly, savedAt: new Date().toISOString() };
      track("saved_medicine");
      if (plus && profileId != null) {
        // Cheapest per-tablet price today, so a later drop can raise an alert.
        const best = comparison?.alternatives.filter((a) => a.mrp?.freshness === "current" && a.mrp.per_unit != null).map((a) => a.mrp!.per_unit!).sort((a, b) => a - b)[0] ?? null;
        accountApi.save({ profile_id: profileId, key: savedKey, data: entry, best_unit_price: best }).then((r) => setCloud(r.saved), () => {});
        return;
      }
      const next = [entry, ...saved.filter((x) => x.key !== savedKey)];
      setSaved(next); storeSaved(next);
    };
    screen = (
      <ResultScreen
        mode={step === 4 && alt ? "savings" : "compare"} onNext={() => { setStep(4); track("savings_viewed"); }}
        headRef={headRef} state={compState} data={comparison}
        onRetry={() => (confirmed.record.medicine_id === "user_pack" && packInfo ? compareByPack(packInfo.f, packInfo.mrp, packInfo.pack, packInfo.brand) : loadComparison(confirmed.record.medicine_id))}
        onNew={reset}
        selectedId={selectedId} onSelect={setSelectedId} sort={sort} setSort={setSort}
        unitsPerDay={unitsPerDay} setUnitsPerDay={setUnitsPerDay}
        basis={effBasis} setBasis={setBasis} bases={bases} outcome={outcome}
        summary={summary} downloader={downloader} canPrint={canPrint}
        shareText={current && alt ? t.shareText(current.brand_name, alt.brand_name, savingText, siteUrl, calc) : ""} onShared={() => track("shared_whatsapp")}
        isSaved={isSaved} onSave={onSave} profiles={plus ? user!.profiles : null}
        feedbackContext={{ medicine_name: current?.brand_name, alternative_name: alt?.brand_name, monthly_saving: monthly, lang }}
        catalogue={DEMO ? catalogue : null}
      />
    );
  } else {
    screen = (
      <HomeScreen
        headRef={headRef} pickerRef={pickerRef} photo={photo} fileError={fileError} onFile={onFile} onRemove={onRemove}
        scenario={scenario} setScenario={setScenario} onSample={onSample} phase={phase} identifyError={identifyError} onIdentify={(live) => guard(() => identify(live))} aiName={aiName}
        manualOpen={manualOpen} setManualOpen={setManualOpen} onManualPick={(m) => guard(() => onManualPick(m))}
        onIdentifyName={visionLive ? (n) => (needLogin ? (setPending({ run: () => { identifyName(n).catch(() => setIdentifyError(t.nameFailed)); } }), Promise.resolve()) : identifyName(n)) : undefined}
        demo={DEMO} saved={homeSaved} alerts={plus && alerts.length ? <AlertList alerts={alerts} user={user!} /> : null} onRecheck={recheckSaved} onRemoveSaved={removeSaved} checks={checks} coverage={catalogue?.medicines ?? null}
      />
    );
  }
  if (user && view !== "app") {
    screen = (
      <AccountScreen headRef={headRef} view={view} setView={setView} user={user} setUser={(u) => setAuth(u)} saved={cloud} setSaved={setCloud} alerts={alerts}
        onBack={() => setView("app")} onRecheck={(c) => { setView("app"); recheckSaved(c.data as SavedMed); }} onSignedOut={signOut} />
    );
  }
  if (needLogin && pending) {
    screen = (
      <LoginScreen headRef={headRef} onCancel={() => setPending(null)}
        onSignedIn={(u) => { const next = pending; setAuth(u); setView("app"); setPending(null); setTimeout(() => next.run(), 0); }} />
    );
  }
  const gated = (needLogin && !!pending) || (user && view !== "app");
  const shownStep: Step = screen.type === HomeScreen || gated ? 1 : step;

  return (
    <I18nProvider value={{ t, lang }}>
      <div className="app">
        <header className="topbar">
          <div className="topbar-inner">
            <button type="button" className="logo" onClick={reset} aria-label={`${t.brand}: ${t.newComparison}`}>
              <span className="logo-mark"><Icon name="pill" size={18} /></span>
              <span className="logo-word">Dawa<span>Compare</span></span>
            </button>
            {DEMO && <span className="proto-pill">{t.demoPill}</span>}
            {needLogin && !pending && (
              <button type="button" className="acct-btn" onClick={() => setPending({ run: () => {} })}>
                <Icon name="user" size={18} /><span className="acct-label">{t.liSignIn}</span>
              </button>
            )}
            {user && (
              <button type="button" className={`acct-btn ${plus ? "is-plus" : ""}`} onClick={() => setView(view === "app" ? "account" : "app")} aria-label={t.acOpen}>
                <Icon name={plus ? "star" : "user"} size={18} /><span className="acct-label">{t.acOpen}</span>
              </button>
            )}
            <div className="lang" role="group" aria-label={t.langLabel}>
              <button type="button" aria-pressed={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button type="button" aria-pressed={lang === "hi"} className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")} lang="hi">हिंदी</button>
            </div>
          </div>
        </header>

        <div className={`layout ${gated ? "is-gated" : ""}`}>
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
                <p className="muted small">{confirmed.record.active_ingredients.join(" + ")} · {confirmed.record.strength}</p>
              </div>
            )}
            <p className="rail-fine">{t.disclaimer}</p>
          </aside>

          <main className="main">
            {shownStep > 1 && (
              <div className="progress">
                <button type="button" className="back" onClick={back}><Icon name="arrowLeft" size={18} />{t.back}</button>
                <span className="progress-label">{t.step(shownStep)} · {t.steps[shownStep - 1]}</span>
                <div className="progress-bar" aria-hidden="true">{[1, 2, 3, 4].map((n) => <span key={n} className={n <= shownStep ? "on" : ""} />)}</div>
              </div>
            )}
            {screen}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
