import React, { useEffect, useState } from "react";
import { apiFetch, apiFetchBlob, apiFetchForm } from "../api/client";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh-Hans", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "my", label: "မြန်မာ" },
];

function filenameFromHeader(value, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(value || "");
  return match?.[1] || fallback;
}

export default function SopLibrary({ onAuthError }) {
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState("");
  const [uploadLanguage, setUploadLanguage] = useState({});
  const [uploadingId, setUploadingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/SopDocuments")
      .then((rows) => {
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        setDocuments(list);
      })
      .catch((e) => {
        if (!active) return;
        const message = e?.message || "Could not load SOP documents.";
        setError(message);
        if (String(message).includes("401") || String(message).includes("403")) onAuthError?.();
      })
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [onAuthError]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  async function openDocument(sopDocument) {
    setError("");
    setOpeningId(sopDocument.id);
    try {
      const { blob, contentDisposition } = await apiFetchBlob(`/api/SopDocuments/${encodeURIComponent(sopDocument.id)}/download`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromHeader(contentDisposition, sopDocument.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e?.message || "Could not open SOP document.";
      setError(message);
      if (String(message).includes("401") || String(message).includes("403")) onAuthError?.();
    } finally {
      setOpeningId("");
    }
  }

  async function previewDocument(sopDocument, language = "en") {
    setError("");
    setPreviewBusy(sopDocument.id);
    try {
      const { blob } = await apiFetchBlob(`/api/SopDocuments/${encodeURIComponent(sopDocument.id)}/preview-pdf?language=${encodeURIComponent(language)}`);
      setPreview({ id: sopDocument.id, title: sopDocument.title, url: URL.createObjectURL(blob), language, availableLanguages: sopDocument.availableLanguages || ["en"] });
    } catch (e) {
      const message = e?.message || "Could not preview SOP document.";
      setError(message);
      if (String(message).includes("401") || String(message).includes("403")) onAuthError?.();
    } finally {
      setPreviewBusy("");
    }
  }

  async function uploadTranslation(sopDocument, file) {
    if (!file) return;
    const language = uploadLanguage[sopDocument.id] || "zh-Hans";
    setError("");
    setUploadingId(sopDocument.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetchForm(`/api/SopDocuments/${encodeURIComponent(sopDocument.id)}/translations/${encodeURIComponent(language)}`, { formData });
      setDocuments((rows) => rows.map((row) => row.id === sopDocument.id
        ? { ...row, availableLanguages: [...new Set([...(row.availableLanguages || ["en"]), language])] }
        : row));
    } catch (e) {
      const message = e?.message || "Could not upload the translated SOP.";
      setError(message);
      if (String(message).includes("401") || String(message).includes("403")) onAuthError?.();
    } finally {
      setUploadingId("");
    }
  }

  return (
    <section className="we-sop-root">
      <header className="we-sop-hero">
        <div>
          <div className="we-sop-kicker">ADMIN LIBRARY</div>
          <h1>SOP Documents</h1>
          <p>Controlled procedures and company forms. Admin access only.</p>
        </div>
        <div className="we-sop-count"><strong>{documents.length}</strong><span>documents</span></div>
      </header>

      {error ? <div className="we-sop-error">{error}</div> : null}
      {busy ? <div className="we-sop-empty">Loading SOP documents…</div> : null}
      {!busy && documents.length === 0 ? <div className="we-sop-empty">No SOP documents are available.</div> : null}

      <div className="we-sop-grid">
        {documents.map((document) => (
          <article className="we-sop-card" key={document.id}>
            <div className="we-sop-cardTop">
              <span className="we-sop-icon" aria-hidden="true">📄</span>
              <span className="we-sop-category">{document.category}</span>
            </div>
            <h2>{document.title}</h2>
            <p>{document.documentNo || "Company form"}</p>
            <button
              type="button"
              className="we-sop-open"
              onClick={() => previewDocument(document)}
              disabled={!document.previewAvailable || previewBusy === document.id}
            >
              {previewBusy === document.id ? "Opening…" : document.previewAvailable ? "Preview PDF" : "Unavailable"}
            </button>
            <button
              type="button"
              className="we-sop-open we-sop-download"
              onClick={() => openDocument(document)}
              disabled={!document.available || openingId === document.id}
            >
              {openingId === document.id ? "Preparing…" : document.available ? "Download DOCX" : "Unavailable"}
            </button>
            <div className="we-sop-translation">
              <select aria-label={`Translation language for ${document.title}`} value={uploadLanguage[document.id] || "zh-Hans"} onChange={(event) => setUploadLanguage((languages) => ({ ...languages, [document.id]: event.target.value }))}>
                {LANGUAGES.filter((language) => language.code !== "en").map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
              </select>
              <label className="we-sop-upload">{uploadingId === document.id ? "Uploading…" : "Upload translated PDF"}<input type="file" accept=".pdf,application/pdf" disabled={uploadingId === document.id} onChange={(event) => { uploadTranslation(document, event.target.files?.[0]); event.target.value = ""; }} /></label>
            </div>
          </article>
        ))}
      </div>

      {preview ? <div className="we-sop-modal" role="dialog" aria-modal="true" aria-label={`${preview.title} preview`}>
        <div className="we-sop-preview">
          <div className="we-sop-previewHead"><div><span>SOP DOCUMENT</span><h2>{preview.title}</h2></div><div className="we-sop-previewActions"><label>Language<select value={preview.language} onChange={(event) => previewDocument(preview, event.target.value)} disabled={previewBusy === preview.id}>{LANGUAGES.filter((language) => preview.availableLanguages.includes(language.code)).map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</select></label><a href={preview.url} target="_blank" rel="noreferrer">Open PDF</a><button type="button" onClick={() => setPreview(null)} aria-label="Close preview">×</button></div></div>
          <iframe className="we-sop-pdf" src={`${preview.url}#zoom=page-width&toolbar=1&navpanes=0`} title={`${preview.title} PDF preview`} />
        </div>
      </div> : null}

      <style>{css}</style>
    </section>
  );
}

const css = `
.we-sop-root{color:var(--we-text,#e5e7eb);display:grid;gap:16px;}
.we-sop-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:24px;border:1px solid var(--we-border,rgba(255,255,255,.14));border-radius:18px;background:linear-gradient(135deg,rgba(31,86,170,.9),rgba(66,150,207,.68));box-shadow:0 14px 34px rgba(7,28,64,.18);}
.we-sop-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:rgba(255,255,255,.72);}
.we-sop-hero h1{margin:5px 0 0;font-size:28px;line-height:1.15;color:#fff;}
.we-sop-hero p{margin:7px 0 0;color:rgba(255,255,255,.8);font-size:13px;}
.we-sop-count{min-width:92px;display:grid;place-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);color:#fff;}
.we-sop-count strong{font-size:25px;line-height:1;}.we-sop-count span{margin-top:4px;font-size:11px;font-weight:800;opacity:.8;}
.we-sop-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
.we-sop-card{display:grid;gap:10px;min-height:190px;padding:18px;border:1px solid var(--we-border,rgba(255,255,255,.14));border-radius:16px;background:var(--we-surface,rgba(15,23,42,.4));box-shadow:0 9px 24px rgba(8,25,54,.08);}
.we-sop-cardTop{display:flex;justify-content:space-between;align-items:center;gap:10px;}.we-sop-icon{font-size:24px;}.we-sop-category{padding:5px 8px;border-radius:999px;background:var(--we-surface-2,rgba(255,255,255,.1));border:1px solid var(--we-border,rgba(255,255,255,.14));font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;}
.we-sop-card h2{margin:2px 0 0;font-size:16px;line-height:1.25;color:var(--we-text,#e5e7eb);}.we-sop-card p{margin:0;font-size:12px;color:var(--we-muted,rgba(226,232,240,.75));}.we-sop-open{align-self:end;width:100%;min-height:38px;border:1px solid var(--we-control-border,rgba(255,255,255,.14));border-radius:11px;background:var(--we-control-bg,rgba(15,23,42,.35));color:var(--we-text,#e5e7eb);font-weight:900;cursor:pointer;}.we-sop-download{align-self:start;min-height:34px;font-size:11px;}.we-sop-open:hover:not(:disabled){filter:brightness(1.12);}.we-sop-open:disabled{cursor:not-allowed;opacity:.55;}.we-sop-translation{display:flex;gap:8px;align-items:center;}.we-sop-translation select{min-width:0;flex:1;border:1px solid var(--we-control-border);border-radius:9px;background:var(--we-control-bg);color:var(--we-text);padding:8px;font:inherit;}.we-sop-upload{display:grid;place-items:center;min-height:34px;padding:0 10px;border:1px solid var(--we-control-border);border-radius:9px;background:var(--we-control-bg);color:var(--we-text);font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;}.we-sop-upload input{display:none;}
.we-sop-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(2,8,22,.7);backdrop-filter:blur(4px);}.we-sop-preview{width:min(1100px,100%);height:min(90vh,920px);display:grid;grid-template-rows:auto 1fr;overflow:hidden;border:1px solid #cbd8e7!important;border-radius:16px;background:#fff!important;box-shadow:0 24px 70px rgba(0,0,0,.34);color:#142949!important;color-scheme:light;}.we-sop-previewHead{display:flex;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #d9e3ef!important;background:#f5f8fc!important;}.we-sop-previewHead span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#60738d!important;}.we-sop-previewHead h2{margin:5px 0 0;font-size:20px;color:#142949!important;}.we-sop-previewActions{display:flex;align-items:center;gap:10px;}.we-sop-previewActions label{display:grid;gap:3px;font-size:10px;font-weight:900;letter-spacing:.06em;color:#60738d!important;}.we-sop-previewActions select{min-width:112px;border:1px solid #b9c9dc!important;border-radius:8px;background:#fff!important;color:#142949!important;padding:6px 8px;font:inherit;letter-spacing:normal;}.we-sop-previewActions select:disabled{opacity:.55;}.we-sop-previewActions a{padding:8px 10px;border:1px solid #b9c9dc;border-radius:8px;color:#244c7d;font-size:12px;font-weight:800;text-decoration:none;}.we-sop-previewHead button{width:32px;height:32px;border:0;border-radius:50%;background:#e7eef7!important;color:#142949!important;font-size:24px;line-height:1;cursor:pointer;}.we-sop-pdf{width:100%;height:100%;border:0;background:#fff;}
.we-sop-empty,.we-sop-error{padding:14px 16px;border-radius:14px;border:1px solid var(--we-border,rgba(255,255,255,.14));background:var(--we-surface,rgba(15,23,42,.4));font-size:13px;}.we-sop-error{color:#fecdd3;border-color:rgba(244,63,94,.28);background:rgba(244,63,94,.12);}
@media (max-width:1050px){.we-sop-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:620px){.we-sop-hero{align-items:flex-start;padding:18px;}.we-sop-grid{grid-template-columns:1fr;}.we-sop-hero h1{font-size:23px;}.we-sop-count{min-width:72px;}.we-sop-card{min-height:170px;}.we-sop-modal{padding:8px;}.we-sop-preview{height:calc(100dvh - 16px);border-radius:12px;}.we-sop-previewHead{align-items:flex-start;flex-direction:column;padding:12px;}.we-sop-previewActions{width:100%;justify-content:space-between;}.we-sop-previewActions select{min-width:94px;}}
`;
