// Small shared building blocks.
import { Icon, IconName } from "./Icon";
import { useI18n } from "../i18n";
import { DEMO } from "../lib/mode";

export type Tone = "info" | "ok" | "warn" | "block";

export function Notice({ tone, icon, children, role }: { tone: Tone; icon: IconName; children: any; role?: string }) {
  return (
    <div className={`notice notice-${tone}`} role={role}>
      <Icon name={icon} size={18} className="notice-icon" />
      <div className="notice-body">{children}</div>
    </div>
  );
}

export function StatusBanner({ tone, icon, title, body, children }: { tone: Tone; icon: IconName; title: string; body?: string; children?: any }) {
  return (
    <div className={`banner banner-${tone}`} role="status">
      <span className="banner-icon"><Icon name={icon} size={22} /></span>
      <div className="banner-text">
        <strong>{title}</strong>
        {body && <p>{body}</p>}
        {children}
      </div>
    </div>
  );
}

export function Chip({ tone = "mute", icon, children }: { tone?: "ok" | "warn" | "block" | "mute" | "user"; icon?: IconName; children: any }) {
  return <span className={`chip chip-${tone}`}>{icon && <Icon name={icon} size={12} />}{children}</span>;
}

/** "SAMPLE DATA" tag, shown only in demo mode. */
export function DemoTag() {
  const { t } = useI18n();
  if (!DEMO) return null;
  return <span className="demo-tag">{t.demoData}</span>;
}

export function ScreenHead({ title, body, headRef }: { title: string; body?: string; headRef: any }) {
  return (
    <div className="screen-head">
      <h1 ref={headRef} tabIndex={-1}>{title}</h1>
      {body && <p className="lede">{body}</p>}
    </div>
  );
}

/** Sticky on phones so the one primary action stays under the thumb. */
export function ActionBar({ children, hint }: { children: any; hint?: any }) {
  return (
    <div className="action-bar">
      {hint}
      <div className="action-row">{children}</div>
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label, id }: { options: { value: T; label: string; disabled?: boolean; title?: string }[]; value: T | null; onChange: (v: T) => void; label: string; id?: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          id={i === 0 ? id : undefined}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.title}
          className={`seg-btn ${value === o.value ? "on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
