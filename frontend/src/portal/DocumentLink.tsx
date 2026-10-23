import { useEffect, useState } from 'react';
import { downloadBlob } from './model';

export function DocumentLink({ fileName, load, disabled = false }: { fileName: string; load: () => Promise<Blob>; disabled?: boolean }) {
  const [preview, setPreview] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const image = /\.(png|jpe?g)$/i.test(fileName); const viewable = image || /\.pdf$/i.test(fileName);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function open(download = false) {
    setBusy(true); setError('');
    try {
      const blob = await load();
      if (download || !viewable) downloadBlob(blob, fileName);
      else {
        const type = /\.pdf$/i.test(fileName) ? 'application/pdf' : /\.png$/i.test(fileName) ? 'image/png' : 'image/jpeg';
        setPreview(URL.createObjectURL(new Blob([blob], { type })));
      }
    }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <><div className="portal-document-actions"><button className="portal-link" disabled={disabled || busy} onClick={() => void open()}>{fileName}</button><button className="portal-link" disabled={disabled || busy} onClick={() => void open(true)}>Tải xuống</button></div>{error && <p role="alert" className="portal-error">{error}</p>}{preview && <div className="portal-preview-backdrop"><section className="portal-preview" role="dialog" aria-modal="true" aria-label={`Xem tài liệu ${fileName}`}><header><strong>{fileName}</strong><button autoFocus className="btn btn-secondary" onClick={() => setPreview('')}>Đóng</button></header>{image ? <img src={preview} alt={fileName} /> : <iframe title={fileName} src={preview} />}</section></div>}</>;
}
