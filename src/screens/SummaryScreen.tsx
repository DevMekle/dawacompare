import { useI18n } from "../i18n";
import { Summary, summaryToHtml, summaryToText } from "../summary/buildSummary";
import { Icon } from "../components/Icon";
import { ActionBar, Notice, ScreenHead } from "../components/ui";
import { SummaryDocument } from "../components/SummaryDocument";

const { useState, useRef } = React;

/** How this view can hand over a file: the artifact viewer's downloads capability, a normal browser download, or nothing. */
export type Downloader = { kind: "claude"; ns: any } | { kind: "native" } | { kind: "none" } | { kind: "pending" };

interface Props {
  headRef: any;
  summary: Summary;
  downloader: Downloader;
  canPrint: boolean;
  onNew: () => void;
}

export function SummaryScreen(p: Props) {
  const { t, lang } = useI18n();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const filename = `DawaCompare-summary-${new Date().toISOString().slice(0, 10)}.html`;

  const download = async () => {
    const html = summaryToHtml(p.summary, t, lang);
    if (p.downloader.kind === "claude") {
      setBusy(true);
      try {
        await p.downloader.ns.save({ filename, data: html });
        setMsg({ ok: true, text: t.downloaded });
      } catch (e: any) {
        setMsg({ ok: false, text: e?.code === "declined" ? t.dlDeclined : t.dlUnavailable });
      } finally {
        setBusy(false);
      }
    } else if (p.downloader.kind === "native") {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg({ ok: true, text: t.downloaded });
    } else {
      setMsg({ ok: false, text: t.dlUnavailable });
    }
  };

  const copy = () => {
    const text = summaryToText(p.summary, t);
    const fallback = () => {
      const sel = window.getSelection();
      if (docRef.current && sel) { const r = document.createRange(); r.selectNodeContents(docRef.current); sel.removeAllRanges(); sel.addRange(r); }
      setMsg({ ok: false, text: t.copyFail });
    };
    try { navigator.clipboard.writeText(text).then(() => setMsg({ ok: true, text: t.copied }), fallback); } catch { fallback(); }
  };

  const canDownload = p.downloader.kind !== "none";

  return (
    <section className="screen">
      <ScreenHead headRef={p.headRef} title={t.s5Title} body={t.s5Body} />
      <SummaryDocument s={p.summary} docRef={docRef} />
      {msg && <Notice tone={msg.ok ? "ok" : "warn"} icon={msg.ok ? "circleCheck" : "alert"} role="status">{msg.text}</Notice>}
      <ActionBar>
        {canDownload ? (
          <button type="button" className="btn btn-primary" onClick={download} disabled={busy}><Icon name="download" size={20} />{busy ? t.downloading : t.download}</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={copy}><Icon name="copy" size={20} />{t.copy}</button>
        )}
      </ActionBar>
      <div className="secondary-row">
        {p.canPrint && <button type="button" className="btn btn-quiet" onClick={() => window.print()}><Icon name="printer" size={16} />{t.print}</button>}
        {canDownload && <button type="button" className="btn btn-quiet" onClick={copy}><Icon name="copy" size={16} />{t.copy}</button>}
        <button type="button" className="btn btn-quiet" onClick={p.onNew}><Icon name="rotate" size={16} />{t.newComparison}</button>
      </div>
    </section>
  );
}
