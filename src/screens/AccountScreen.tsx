// Account: plan, family profiles, synced saved medicines with refill reminders, alerts,
// sign out and delete account. "plans" view: Free vs Plus with a test-mode checkout.

import { useI18n } from "../i18n";
import { accountApi, Alert, CloudSaved, Me, PLUS_PRICE } from "../api/account";
import { fmtDate, inr } from "../lib/format";
import { Icon } from "../components/Icon";
import { Notice, Spinner } from "../components/ui";

const { useState } = React;

interface Props {
  headRef: any;
  view: "account" | "plans";
  setView: (v: "account" | "plans") => void;
  user: Me;
  setUser: (u: Me) => void;
  saved: CloudSaved[];
  setSaved: (s: CloudSaved[]) => void;
  alerts: Alert[];
  onBack: () => void;
  onRecheck: (s: CloudSaved) => void;
  onSignedOut: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const masked = (p: string) => `+91 ${p.slice(3, 5)}•••• ${p.slice(-4)}`;

export function AlertList({ alerts, user }: { alerts: Alert[]; user: Me }) {
  const { t, lang } = useI18n();
  const who = (id: number) => user.profiles.find((p) => p.id === id)?.name ?? "";
  if (!alerts.length) return null;
  return (
    <ul className="alerts">
      {alerts.map((a, i) => (
        <li key={i} className={`alert-item alert-${a.kind}`}>
          <Icon name={a.kind === "price_drop" ? "trendingDown" : "bell"} size={18} />
          <span>{a.kind === "price_drop"
            ? t.alertDrop(`${a.medicine} (${who(a.profile_id)})`, a.option!, inr(a.unit_now!, true), inr(a.unit_before!, true))
            : t.alertRefill(a.medicine, who(a.profile_id), fmtDate(a.date!, lang))}</span>
        </li>
      ))}
    </ul>
  );
}

function ReminderEditor({ s, onChange }: { s: CloudSaved; onChange: (every: number | null, next: string | null) => Promise<void> }) {
  const { t } = useI18n();
  const [every, setEvery] = useState<number | null>(s.refill_every_days ?? 30);
  const [next, setNext] = useState(s.next_refill ?? today());
  const [busy, setBusy] = useState(false);
  const run = async (e: number | null, n: string | null) => { setBusy(true); try { await onChange(e, n); } finally { setBusy(false); } };
  return (
    <div className="reminder">
      <span className="field-label">{t.acReminder}</span>
      <div className="reminder-row">
        <select className="input input-sm" aria-label={t.acReminder} value={every ?? ""} onChange={(e: any) => setEvery(e.target.value ? Number(e.target.value) : null)}>
          {[15, 28, 30, 60, 90].map((n) => <option key={n} value={n}>{t.acEvery(n)}</option>)}
        </select>
        <label className="sr-label"><span className="visually-hidden">{t.acNextRefill}</span>
          <input className="input input-sm" type="date" aria-label={t.acNextRefill} min={today()} value={next} onChange={(e: any) => setNext(e.target.value)} />
        </label>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !every || !next} onClick={() => run(every, next)}>{t.acReminderSet}</button>
        {s.refill_every_days && <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run(null, null)}>{t.acReminderOff}</button>}
      </div>
    </div>
  );
}

export function AccountScreen(p: Props) {
  const { t, lang } = useI18n();
  const plus = p.user.plan === "plus";
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setMsg(null);
    try { await fn(); } catch (e: any) { setMsg({ ok: false, text: t.liErrors[e.message] ?? t.liUnavailable }); } finally { setBusy(null); }
  };

  if (p.view === "plans") {
    const free = ["check", "share", "local"], plusOnly = ["sync", "profiles", "reminders", "alerts"];
    return (
      <section className="screen">
        <button type="button" className="back" onClick={() => p.setView("account")}><Icon name="arrowLeft" size={18} />{t.acBack}</button>
        <h1 ref={p.headRef} tabIndex={-1}>{t.plTitle}</h1>
        <div className="plans">
          <div className={`card plan ${plus ? "" : "is-current"}`}>
            <h2>{t.plFree}</h2><p className="plan-price">{t.plFreeLine}</p>
            <ul>{free.map((k) => <li key={k}><Icon name="check" size={16} />{t.plFeatures[k]}</li>)}</ul>
            {!plus && <p className="muted small">{t.plCurrent}</p>}
          </div>
          <div className={`card plan plan-plus ${plus ? "is-current" : ""}`}>
            <h2><Icon name="star" size={18} />{t.acPlanPlus}</h2><p className="plan-price">{t.plPlusLine(PLUS_PRICE)}</p>
            <ul>{[...free, ...plusOnly].map((k) => <li key={k} className={plusOnly.includes(k) ? "plus-feat" : ""}><Icon name="check" size={16} />{t.plFeatures[k]}</li>)}</ul>
            {plus ? <p className="muted small">{t.plCurrent} · {t.acPlusUntil(fmtDate(p.user.plan_until!, lang))}</p> : (
              <>
                <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act("sub", async () => { const r = await accountApi.subscribe(); p.setUser(r.user); p.setView("account"); setMsg({ ok: true, text: t.plWelcome }); })}>
                  {busy === "sub" ? <Spinner /> : <Icon name="star" size={18} />}{t.plStart}
                </button>
                <p className="muted small">{t.plTestNote}</p>
              </>
            )}
          </div>
        </div>
        {msg && <Notice tone={msg.ok ? "ok" : "warn"} icon="info" role="status">{msg.text}</Notice>}
      </section>
    );
  }

  const byProfile = p.user.profiles.map((pr) => ({ pr, items: p.saved.filter((s) => s.profile_id === pr.id) }));
  return (
    <section className="screen account">
      <button type="button" className="back" onClick={p.onBack}><Icon name="arrowLeft" size={18} />{t.acBack}</button>
      <h1 ref={p.headRef} tabIndex={-1}>{t.acTitle}</h1>
      <p className="muted"><Icon name="smartphone" size={16} /> {masked(p.user.phone)}</p>
      {msg && <Notice tone={msg.ok ? "ok" : "warn"} icon={msg.ok ? "circleCheck" : "alert"} role="status">{msg.text}</Notice>}

      <div className={`card plan-card ${plus ? "plan-plus" : ""}`}>
        <div>
          <strong>{plus ? <><Icon name="star" size={16} /> {t.acPlanPlus}</> : t.acPlanFree}</strong>
          {plus && <p className="muted small">{t.acPlusUntil(fmtDate(p.user.plan_until!, lang))}</p>}
        </div>
        {plus
          ? <button type="button" className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => act("cancel", async () => p.setUser((await accountApi.cancel()).user))}>{t.acCancel}</button>
          : <button type="button" className="btn btn-primary btn-sm" onClick={() => p.setView("plans")}><Icon name="star" size={16} />{t.acUpgrade(PLUS_PRICE)}</button>}
      </div>

      {plus && (
        <>
          <h2 className="ac-h"><Icon name="bell" size={18} />{t.acAlerts}</h2>
          {p.alerts.length ? <AlertList alerts={p.alerts} user={p.user} /> : <p className="muted small">{t.acNoAlerts}</p>}
        </>
      )}

      <h2 className="ac-h"><Icon name="users" size={18} />{t.acProfiles}{!plus && <span className="chip chip-mute"><Icon name="lock" size={12} />{t.acLocked}</span>}</h2>
      <p className="muted small">{t.acProfilesHint}</p>
      <ul className="profiles">
        {p.user.profiles.map((pr) => (
          <li key={pr.id} className="profile">
            {renaming?.id === pr.id ? (
              <form className="profile-edit" onSubmit={(e: any) => { e.preventDefault(); act("ren", async () => { p.setUser((await accountApi.renameProfile(pr.id, renaming.name)).user); setRenaming(null); }); }}>
                <input className="input input-sm" aria-label={t.acRename} maxLength={40} value={renaming.name} onChange={(e: any) => setRenaming({ id: pr.id, name: e.target.value })} autoFocus />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={!!busy}>{t.acSave}</button>
              </form>
            ) : (
              <>
                <span className="profile-name"><Icon name="user" size={16} />{pr.name}</span>
                <span className="profile-actions">
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setRenaming({ id: pr.id, name: pr.name })}><Icon name="pencil" size={14} />{t.acRename}</button>
                  {p.user.profiles.length > 1 && <button type="button" className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => act("rm", async () => { p.setUser((await accountApi.removeProfile(pr.id)).user); p.setSaved(p.saved.filter((s) => s.profile_id !== pr.id)); })}><Icon name="trash" size={14} />{t.acRemove}</button>}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {plus && p.user.profiles.length < p.user.limits.profiles && (
        <form className="profile-add" onSubmit={(e: any) => { e.preventDefault(); if (newName.trim()) act("add", async () => { p.setUser((await accountApi.addProfile(newName)).user); setNewName(""); }); }}>
          <input className="input" aria-label={t.acProfileName} placeholder={t.acProfileName} maxLength={40} value={newName} onChange={(e: any) => setNewName(e.target.value)} />
          <button type="submit" className="btn btn-secondary" disabled={!!busy || !newName.trim()}><Icon name="plus" size={16} />{t.acAddProfile}</button>
        </form>
      )}

      <h2 className="ac-h"><Icon name="pill" size={18} />{t.acSavedTitle}{!plus && <span className="chip chip-mute"><Icon name="lock" size={12} />{t.acLocked}</span>}</h2>
      {plus ? (
        p.saved.length === 0 ? <p className="muted small">{t.acSavedEmpty}</p> : (
          <>
            <p className="muted small">{t.acReminderNote}</p>
            {byProfile.filter((g) => g.items.length).map(({ pr, items }) => (
              <div key={pr.id} className="saved-group">
                <h3><Icon name="user" size={15} />{pr.name}</h3>
                <ul className="saved-cloud">
                  {items.map((s) => (
                    <li key={s.id} className="card saved-cloud-item">
                      <div className="saved-main">
                        <strong>{s.data?.brand}</strong>
                        <span className="muted small">{s.data?.altName ? `→ ${s.data.altName}` : ""}{s.data?.monthlySaving ? ` · ${t.savedSaving(inr(s.data.monthlySaving))}` : ""}</span>
                      </div>
                      <ReminderEditor s={s} onChange={async (e, n) => p.setSaved((await accountApi.reminder(s.id, e, n)).saved)} />
                      <div className="saved-actions">
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => p.onRecheck(s)}><Icon name="rotate" size={14} />{t.recheck}</button>
                        <button type="button" className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => act("uns", async () => p.setSaved((await accountApi.unsave(s.id)).saved))}><Icon name="trash" size={14} />{t.removeMed}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )
      ) : <p className="muted small">{t.plFeatures.sync} · {t.plFeatures.reminders} · {t.plFeatures.alerts}</p>}

      <div className="account-foot">
        <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => act("out", async () => { await accountApi.logout(); p.onSignedOut(); })}><Icon name="logOut" size={18} />{t.acSignOut}</button>
        {!confirmDelete ? (
          <button type="button" className="btn btn-quiet btn-danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} />{t.acDelete}</button>
        ) : (
          <div className="delete-confirm" role="alert">
            <p>{t.acDeleteConfirm}</p>
            <div className="secondary-row">
              <button type="button" className="btn btn-danger-solid" disabled={!!busy} onClick={() => act("del", async () => { await accountApi.deleteAccount(); p.onSignedOut(); })}>{t.acDeleteYes}</button>
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>{t.acDeleteNo}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
