import React, { useEffect, useState } from "react";
import { apiFetch, apiFetchBlob } from "../api/client";

function filenameFromHeader(value, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(value || "");
  return match?.[1] || fallback;
}

export default function SopLibrary({ onAuthError }) {
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(true);
  const [openingId, setOpeningId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/SopDocuments")
      .then((rows) => active && setDocuments(Array.isArray(rows) ? rows : []))
      .catch((e) => {
        if (!active) return;
        const message = e?.message || "Could not load SOP documents.";
        setError(message);
        if (String(message).includes("401") || String(message).includes("403")) onAuthError?.();
      })
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [onAuthError]);

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
              onClick={() => openDocument(document)}
              disabled={!document.available || openingId === document.id}
            >
              {openingId === document.id ? "Preparing…" : document.available ? "Download DOCX" : "Unavailable"}
            </button>
          </article>
        ))}
      </div>

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
.we-sop-card h2{margin:2px 0 0;font-size:16px;line-height:1.25;color:var(--we-text,#e5e7eb);}.we-sop-card p{margin:0;font-size:12px;color:var(--we-muted,rgba(226,232,240,.75));}.we-sop-open{align-self:end;width:100%;min-height:38px;border:1px solid var(--we-control-border,rgba(255,255,255,.14));border-radius:11px;background:var(--we-control-bg,rgba(15,23,42,.35));color:var(--we-text,#e5e7eb);font-weight:900;cursor:pointer;}.we-sop-open:hover:not(:disabled){filter:brightness(1.12);}.we-sop-open:disabled{cursor:not-allowed;opacity:.55;}
.we-sop-empty,.we-sop-error{padding:14px 16px;border-radius:14px;border:1px solid var(--we-border,rgba(255,255,255,.14));background:var(--we-surface,rgba(15,23,42,.4));font-size:13px;}.we-sop-error{color:#fecdd3;border-color:rgba(244,63,94,.28);background:rgba(244,63,94,.12);}
@media (max-width:1050px){.we-sop-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:620px){.we-sop-hero{align-items:flex-start;padding:18px;}.we-sop-grid{grid-template-columns:1fr;}.we-sop-hero h1{font-size:23px;}.we-sop-count{min-width:72px;}.we-sop-card{min-height:170px;}}
`;
