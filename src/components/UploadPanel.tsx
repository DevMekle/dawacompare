import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import { Notice } from "./ui";

const { useRef, useState, useEffect } = React;

export interface Photo { url: string; name: string; sample: boolean; file?: File }

interface Props {
  photo: Photo | null;
  error: string | null;
  onFile: (f: File) => void;
  onRemove: () => void;
  /** Lets the parent open the picker (e.g. "Retake photo"). */
  pickerRef?: any;
}

/** Photo intake: file upload, camera capture on phones, drag-and-drop, preview and replace. */
export function UploadPanel({ photo, error, onFile, onRemove, pickerRef }: Props) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo?.url]);
  if (pickerRef) pickerRef.current = { file: () => fileInput.current?.click(), camera: () => camInput.current?.click() };

  const take = (e: any) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  return (
    <div className="upload">
      <input ref={fileInput} id="photo-file" type="file" accept="image/*,.heic,.heif" className="visually-hidden" onChange={take} tabIndex={-1} />
      <input ref={camInput} id="photo-camera" type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={take} tabIndex={-1} />

      {photo ? (
        <div className="preview">
          <div className="preview-frame">
            {broken ? (
              <div className="preview-fallback"><Icon name="camera" size={28} /><span>{photo.name}</span></div>
            ) : (
              <img src={photo.url} alt={photo.name} onError={() => setBroken(true)} />
            )}
            {photo.sample && <span className="preview-tag">{t.demoData}</span>}
          </div>
          <div className="preview-meta">
            <span className="file-name" title={photo.name}>{photo.name}</span>
            <div className="preview-actions">
              <button type="button" className="btn btn-quiet" onClick={() => fileInput.current?.click()}><Icon name="upload" size={16} />{t.replace}</button>
              <button type="button" className="btn btn-quiet" onClick={onRemove}><Icon name="x" size={16} />{t.remove}</button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`drop ${drag ? "is-drag" : ""}`}
          onDragOver={(e: any) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e: any) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        >
          <button type="button" className="drop-target" onClick={() => fileInput.current?.click()} aria-label={t.uploadCta}>
            <span className="drop-icon"><Icon name="camera" size={30} /></span>
            <span className="drop-title">{t.dropTitle}</span>
          </button>
          <div className="reqs">
            <p className="reqs-title">{t.reqTitle}</p>
            <ul>{t.reqs.map((r) => <li key={r}><Icon name="check" size={14} />{r}</li>)}</ul>
          </div>
        </div>
      )}
      {error && <Notice tone="warn" icon="alert" role="alert">{error}</Notice>}
    </div>
  );
}
