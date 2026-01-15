// src/screens/HistoryScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { attendanceApi } from "../api/attendance";

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const mins = Math.round((y - x) / 60000);
  return mins >= 0 ? mins : null;
}

export function HistoryScreen({ onAuthError }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  async function load() {
    setErr("");
    setBusy(true);
    try {
      const data = await attendanceApi.me();
      const list = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];

      // newest first
      list.sort((a, b) => new Date(b.checkInAt || 0) - new Date(a.checkInAt || 0));
      setRows(list);
    } catch (e) {
      const msg = e?.message || "Failed to load history";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCount = useMemo(() => rows.filter((r) => !r.checkOutAt).length, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (onlyOpen && r.checkOutAt) return false;
      if (!s) return true;

      const note = (r.note || "").toLowerCase();
      const id = String(r.id || "");
      const inText = fmt(r.checkInAt).toLowerCase();
      const outText = fmt(r.checkOutAt).toLowerCase();

      return note.includes(s) || id.includes(s) || inText.includes(s) || outText.includes(s);
    });
  }, [rows, q, onlyOpen]);

  return (
    <div className="we-h-root">
      {/* background (same as Clock/Login) */}
      <div className="we-h-bg" aria-hidden="true">
        <div className="we-h-blob we-h-blob-1" />
        <div className="we-h-blob we-h-blob-2" />
        <div className="we-h-blob we-h-blob-3" />
        <div className="we-h-noise" />
      </div>

      <div className="we-h-wrap">
        {/* Header */}
        <div className="we-h-head">
          <div>
            <div className="we-h-kicker">Your activity</div>
            <div className="we-h-title">History</div>
            <div className="we-h-sub">
              {rows.length} total • {openCount} open
            </div>
          </div>

          <button className="we-btn" onClick={load} disabled={busy}>
            {busy ? (
              <span className="we-btn-spin">
                <span className="spinner" />
                Loading…
              </span>
            ) : (
              "Refresh"
            )}
          </button>
        </div>

        {err ? <div className="we-error">{err}</div> : null}

        {/* Filters (glass card) */}
        <div className="we-glass">
          <div className="we-h-filterGrid">
            <label className="we-h-label">
              Search
              <div className="we-input">
                <span className="we-icon" aria-hidden="true">
                  🔎
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by note / id / date"
                />
              </div>
            </label>

            <label className="we-h-check">
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => setOnlyOpen(e.target.checked)}
              />
              Show only open sessions
            </label>
          </div>
        </div>

        {/* List (glass card) */}
        <div className="we-glass">
          {filtered.length === 0 ? (
            <div className="we-h-empty">
              {rows.length === 0 ? "No history yet. Try checking in first." : "No matches found."}
            </div>
          ) : (
            <div className="we-h-list">
              {filtered.map((r) => {
                const mins = minutesBetween(r.checkInAt, r.checkOutAt);
                const isOpen = !r.checkOutAt;

                return (
                  <div key={r.id} className="we-h-item">
                    <div className="we-h-itemTop">
                      <div className="we-h-itemId">#{r.id}</div>
                      <span className={`we-h-pill ${isOpen ? "open" : "closed"}`}>
                        {isOpen ? "OPEN" : "CLOSED"}
                      </span>
                    </div>

                    {r.note ? (
                      <div className="we-h-note">
                        <span className="we-h-strong">Note:</span> {r.note}
                      </div>
                    ) : null}

                    <div className="we-h-times">
                      <div className="we-h-timeRow">
                        <span className="we-h-timeLabel">In</span>
                        <span className="we-h-timeVal">{fmt(r.checkInAt)}</span>
                      </div>
                      <div className="we-h-timeRow">
                        <span className="we-h-timeLabel">Out</span>
                        <span className="we-h-timeVal">{fmt(r.checkOutAt)}</span>
                      </div>
                    </div>

                    <div className="we-h-duration">
                      <span className="we-h-dim">Duration</span>
                      <span className="we-h-dVal">{mins === null ? "—" : `${mins} min`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
/* ===== Root + background (same language as Clock/Login) ===== */
.we-h-root{
  position:relative;
  overflow:hidden;
  padding: 8px 0 0;
}
.we-h-bg{ position:fixed; inset:0; z-index:0; background:#0b1220; }
.we-h-blob{
  position:absolute;
  width:560px; height:560px;
  filter: blur(70px);
  opacity:.55;
  border-radius:999px;
}
.we-h-blob-1{ top:-220px; left:-220px; background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%); }
.we-h-blob-2{ bottom:-260px; right:-220px; background: radial-gradient(circle at 30% 30%, #22c55e, transparent 55%); }
.we-h-blob-3{ top:25%; right:-280px; background: radial-gradient(circle at 30% 30%, #06b6d4, transparent 55%); }

.we-h-noise{
  position:absolute; inset:0;
  opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.we-h-wrap{
  position:relative;
  z-index:1;
  display:grid;
  gap:12px;
  color:#e5e7eb;
}

/* ===== Header ===== */
.we-h-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.we-h-kicker{ font-size:12px; opacity:.75; }
.we-h-title{ margin-top:2px; font-size:26px; font-weight:950; color:#fff; line-height:1.1; }
.we-h-sub{ margin-top:6px; font-size:12px; color: rgba(226,232,240,.75); }

/* ===== Glass containers ===== */
.we-glass{
  background: rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.16);
  border-radius:18px;
  padding:14px;
  box-shadow: 0 30px 80px rgba(0,0,0,.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* ===== Reused input + icon (same as Clock/Login) ===== */
.we-input{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 12px;
  border-radius:14px;
  background: rgba(15,23,42,.35);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
}
.we-input input{
  width:100%;
  border:0;
  outline:none;
  background:transparent;
  color:#fff;
  font-size:14px;
}
.we-input input::placeholder{ color: rgba(226,232,240,.55); }
.we-icon{ opacity:.85; font-size:16px; }

.we-h-filterGrid{ display:grid; gap:10px; }
.we-h-label{
  font-size:12px;
  font-weight:800;
  opacity:.9;
  display:grid;
  gap:8px;
}

/* checkbox */
.we-h-check{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
  opacity:.9;
  user-select:none;
}
.we-h-check input{
  width:16px; height:16px;
  accent-color: #a5b4fc;
}

/* ===== Buttons + spinner (same as Clock/Login) ===== */
.we-btn{
  border:0;
  border-radius:14px;
  padding:12px 14px;
  background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1));
  color:#fff;
  font-weight:900;
  font-size:14px;
  cursor:pointer;
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .12s ease, opacity .12s ease;
  white-space:nowrap;
}
.we-btn:hover{ filter: brightness(1.05); transform: translateY(-1px); }
.we-btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; }

.we-btn-spin{ display:flex; align-items:center; justify-content:center; gap:10px; }
.spinner{
  width:16px;height:16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.5);
  border-top-color:#fff;
  animation:spin .9s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg);} }

/* ===== Error (same as Clock/Login) ===== */
.we-error{
  background: rgba(244,63,94,.14);
  border:1px solid rgba(244,63,94,.28);
  color:#fecdd3;
  border-radius:14px;
  padding:10px 12px;
  font-size:12px;
  font-weight:800;
  word-break: break-word;
}

/* ===== List ===== */
.we-h-empty{ font-size:13px; opacity:.78; }

.we-h-list{ display:grid; gap:10px; }

.we-h-item{
  padding:12px;
  border-radius:14px;
  background: rgba(15,23,42,.32);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  display:grid;
  gap:10px;
}

.we-h-itemTop{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}
.we-h-itemId{ font-weight:950; color:#fff; }

/* status pill */
.we-h-pill{
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
  white-space:nowrap;
}
.we-h-pill.open{
  background: rgba(34,197,94,.14);
  border-color: rgba(34,197,94,.28);
  color: #bbf7d0;
}
.we-h-pill.closed{
  background: rgba(226,232,240,.10);
  border-color: rgba(226,232,240,.16);
  color: rgba(226,232,240,.9);
}

.we-h-note{
  font-size:13px;
  opacity:.9;
  word-break: break-word;
}
.we-h-strong{ font-weight:900; color:#fff; }

.we-h-times{ display:grid; gap:6px; }
.we-h-timeRow{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:baseline;
}
.we-h-timeLabel{ font-size:12px; font-weight:900; color: rgba(226,232,240,.80); }
.we-h-timeVal{
  font-size:12px;
  color: rgba(226,232,240,.92);
  text-align:right;
  min-width:0;
  word-break: break-word;
}

.we-h-duration{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  font-size:12px;
  color: rgba(226,232,240,.85);
}
.we-h-dim{ opacity:.75; }
.we-h-dVal{ font-weight:900; color:#fff; }

/* ===== Mobile responsiveness ===== */
@media (max-width: 520px){
  .we-h-head{
    flex-direction:column;
    align-items:stretch;
  }
  .we-btn{
    width:100%;
  }
  .we-h-title{ font-size:24px; }
}
`;