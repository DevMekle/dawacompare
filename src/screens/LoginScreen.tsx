// Sign in with a mobile number and a 6-digit SMS code. A first sign-in creates the account
// (consent required). Without an SMS provider the server runs in test mode and the code is shown.

import { useI18n } from "../i18n";
import { accountApi, Me } from "../api/account";
import { Icon } from "../components/Icon";
import { Notice, Spinner } from "../components/ui";

const { useState, useEffect, useRef } = React;

export function LoginScreen({ headRef, onSignedIn }: { headRef: any; onSignedIn: (u: Me) => void }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [testCode, setTestCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const errText = (code: string) => t.liErrors[code] ?? t.liUnavailable;
  const digits = phone.replace(/\D/g, "").slice(-10);
  const shown = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

  const send = async () => {
    setError(null);
    if (!/^[6-9]\d{9}$/.test(digits)) return setError(errText("bad_phone"));
    if (!consent) return setError(errText("consent_required"));
    setBusy(true);
    try {
      const r = await accountApi.requestOtp(digits);
      setTestCode(r.test_code ?? null);
      setStage("code");
      setCode("");
      setWait(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e: any) {
      setError(errText(e.message));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError(errText("bad_code"));
    setBusy(true);
    try {
      const r = await accountApi.verifyOtp(digits, code, consent);
      onSignedIn(r.user);
    } catch (e: any) {
      setError(errText(e.message));
      setBusy(false);
    }
  };

  return (
    <section className="screen login">
      <div className="card login-card">
        <span className="login-icon"><Icon name="smartphone" size={26} /></span>
        {stage === "phone" ? (
          <>
            <h1 ref={headRef} tabIndex={-1}>{t.liTitle}</h1>
            <p className="lede">{t.liBody}</p>
            <form onSubmit={(e: any) => { e.preventDefault(); send(); }} className="login-form">
              <label htmlFor="li-phone" className="field-label">{t.liPhone}</label>
              <div className="phone-box">
                <span className="phone-cc">+91</span>
                <input id="li-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="98765 43210"
                  value={phone} onChange={(e: any) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))} />
              </div>
              <label className="check">
                <input type="checkbox" id="li-consent" checked={consent} onChange={(e: any) => setConsent(e.target.checked)} />
                <span>{t.liConsent}</span>
              </label>
              {error && <Notice tone="block" icon="alert" role="alert">{error}</Notice>}
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <><Spinner />{t.liSending}</> : <>{t.liSend}<Icon name="arrowRight" size={18} /></>}</button>
            </form>
          </>
        ) : (
          <>
            <h1 ref={headRef} tabIndex={-1}>{t.liCodeTitle(shown)}</h1>
            {testCode && <Notice tone="warn" icon="info">{t.liTestMode(testCode)}</Notice>}
            <form onSubmit={(e: any) => { e.preventDefault(); verify(); }} className="login-form">
              <label htmlFor="li-code" className="field-label">{t.liCode}</label>
              <input id="li-code" ref={codeRef} className="input code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
                value={code} onChange={(e: any) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              {error && <Notice tone="block" icon="alert" role="alert">{error}</Notice>}
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <><Spinner />{t.liVerifying}</> : <><Icon name="shieldCheck" size={18} />{t.liVerify}</>}</button>
            </form>
            <div className="secondary-row">
              <button type="button" className="btn btn-quiet" onClick={() => { setStage("phone"); setError(null); setTestCode(null); }}><Icon name="pencil" size={16} />{t.liChange}</button>
              <button type="button" className="btn btn-quiet" disabled={wait > 0 || busy} onClick={send}><Icon name="rotate" size={16} />{wait > 0 ? t.liResendIn(wait) : t.liResend}</button>
            </div>
          </>
        )}
      </div>
      <p className="rail-fine login-fine">{t.disclaimer}</p>
    </section>
  );
}
