// src/screens/ClockScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";
import { getCurrentLocation } from "../utils/location";
import { fmtDateTime } from "../utils/datetime";

function hasLatLng(lat, lng) {
  return typeof lat === "number" && typeof lng === "number";
}

function mapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function fmtLocation(lat, lng, acc) {
  if (!hasLatLng(lat, lng)) return "—";
  const accTxt = typeof acc === "number" ? ` (±${Math.round(acc)}m)` : "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${accTxt}`;
}

export function ClockScreen({ onAuthError }) {
  const [open, setOpen] = useState(null);
  const [recent, setRecent] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    try {
      const o = await attendanceApi.open();
      setOpen(o);
      const rows = await attendanceApi.me();
      setRecent((rows || []).slice(0, 8));
    } catch (e) {
      const msg = e?.message || "Failed to load";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkIn() {
    setBusy(true);
    setErr("");
    try {
      const location = await getCurrentLocation(); // may be null (allowed)
      await attendanceApi.checkIn(note, location);
      setNote("");
      await refresh();
    } catch (e) {
      const msg = e?.message || "Check-in failed";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true);
    setErr("");
    try {
      const location = await getCurrentLocation(); // may be null (allowed)
      await attendanceApi.checkOut(location);
      await refresh();
    } catch (e) {
      const msg = e?.message || "Check-out failed";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const statusText = useMemo(() => (open ? "Checked in" : "Not checked in"), [open]);
  const statusSub = useMemo(
    () => (open ? `Since ${fmtDateTime(open.checkInAt)}` : "Tap check in to start"),
    [open]
  );

  // If you return open.CheckInLat/Lng from backend open endpoint:
  const openLocText = useMemo(() => {
    if (!open) return null;
    const t = fmtLocation(open.checkInLat, open.checkInLng, open.checkInAccuracyMeters);
    return t === "—" ? null : t;
  }, [open]);

  return (
    <div className="we-clock-root">
      {/* background */}
      <div className="we-clock-bg" aria-hidden="true">
        <div className="we-clock-blob we-clock-blob-1" />
        <div className="we-clock-blob we-clock-blob-2" />
        <div className="we-clock-blob we-clock-blob-3" />
        <div className="we-clock-noise" />
      </div>

      <div className="we-clock-wrap">
        {/* header (glass) */}
        <div className="we-clock-top">
          <div>
            <div className="we-clock-kicker">Clock in / out</div>
            <div className="we-clock-title">{statusText}</div>
            <div className="we-clock-sub">
              {open ? "You are currently checked in." : "You are currently not checked in."}
            </div>
          </div>

          <span className={`we-clock-pill ${open ? "open" : "off"}`}>{open ? "OPEN" : "OFF"}</span>
        </div>

        {/* status */}
        <Card className="we-glass-card">
          <div className="we-clock-statusRow">
            <div className="we-clock-statusText">
              <div className="we-clock-statusLabel">Status</div>
              <div className="we-clock-statusValue">{statusText}</div>
              <div className="we-clock-statusMeta">{statusSub}</div>

              {open && openLocText ? (
                <div className="we-clock-locLine">
                  <span className="we-clock-strong">📍 Check-in loc:</span> {openLocText}
                  {" "}
                  {hasLatLng(open.checkInLat, open.checkInLng) ? (
                    <a
                      className="we-clock-mapLink"
                      href={mapUrl(open.checkInLat, open.checkInLng)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Map
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="we-clock-mini">
              <div className="we-clock-miniDot" aria-hidden="true">
                {open ? "✅" : "⏸️"}
              </div>
              <div className="we-clock-miniText">
                <div className="we-clock-miniTop">{open ? "Working" : "Idle"}</div>
                <div className="we-clock-miniBot">{open ? "Don’t forget to check out" : "Ready when you are"}</div>
              </div>
            </div>
          </div>

          {!open ? (
            <div className="we-clock-actions">
              <label className="we-clock-label">
                Note (optional)
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">📝</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Site visit"
                    disabled={busy}
                  />
                </div>
              </label>

              <div className="we-clock-btnRow">
                <button className="we-btn" onClick={checkIn} disabled={busy}>
                  {busy ? (
                    <span className="we-btn-spin">
                      <span className="spinner" />
                      Checking in…
                    </span>
                  ) : (
                    "Check in"
                  )}
                </button>

                <button className="we-btn-soft" onClick={refresh} disabled={busy}>
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="we-clock-btnRow">
              <button className="we-btn danger" onClick={checkOut} disabled={busy}>
                {busy ? (
                  <span className="we-btn-spin">
                    <span className="spinner" />
                    Checking out…
                  </span>
                ) : (
                  "Check out"
                )}
              </button>

              <button className="we-btn-soft" onClick={refresh} disabled={busy}>
                Refresh
              </button>
            </div>
          )}

          {err ? <div className="we-error">{err}</div> : null}
        </Card>

        {/* recent */}
        <Card className="we-glass-card">
          <div className="we-clock-recentHead">
            <div className="we-clock-recentTitle">Recent activity</div>
            <div className="we-clock-recentMeta">Latest {Math.min(8, recent.length)} records</div>
          </div>

          {recent.length === 0 ? (
            <div className="we-clock-empty">No records yet.</div>
          ) : (
            <div className="we-clock-list">
              {recent.map((r) => (
                <div key={r.id} className="we-clock-item">
                  <div className="we-clock-itemTop">
                    <div className="we-clock-itemId">#{r.id}</div>
                    <div className="we-clock-itemNote">{r.note ? `Note: ${r.note}` : ""}</div>
                  </div>

                  <div className="we-clock-itemGrid">
                    <div>
                      <span className="we-clock-strong">In:</span> {fmtDateTime(r.checkInAt)}
                    </div>
                    <div>
                      <span className="we-clock-strong">Out:</span> {fmtDateTime(r.checkOutAt)}
                    </div>

                    <div className="we-clock-locRow">
                      <span className="we-clock-strong">📍 In loc:</span>{" "}
                      {fmtLocation(r.checkInLat, r.checkInLng, r.checkInAccuracyMeters)}
                      {" "}
                      {hasLatLng(r.checkInLat, r.checkInLng) ? (
                        <a
                          className="we-clock-mapLink"
                          href={mapUrl(r.checkInLat, r.checkInLng)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Map
                        </a>
                      ) : null}
                    </div>

                    <div className="we-clock-locRow">
                      <span className="we-clock-strong">📍 Out loc:</span>{" "}
                      {fmtLocation(r.checkOutLat, r.checkOutLng, r.checkOutAccuracyMeters)}
                      {" "}
                      {hasLatLng(r.checkOutLat, r.checkOutLng) ? (
                        <a
                          className="we-clock-mapLink"
                          href={mapUrl(r.checkOutLat, r.checkOutLng)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Map
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <style>{css}</style>
    </div>
  );
}

/* Same CSS as yours + small additions for location rows */
const css = `
.we-clock-root{
  position:relative;
  overflow:hidden;
  padding: 8px 0 0;
}

.we-clock-bg{ position:fixed; inset:0; z-index:0; background:#0b1220; }
.we-clock-blob{
  position:absolute;
  width:560px; height:560px;
  filter: blur(70px);
  opacity:.55;
  border-radius:999px;
}
.we-clock-blob-1{ top:-220px; left:-220px; background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%); }
.we-clock-blob-2{ bottom:-260px; right:-220px; background: radial-gradient(circle at 30% 30%, #22c55e, transparent 55%); }
.we-clock-blob-3{ top:25%; right:-280px; background: radial-gradient(circle at 30% 30%, #06b6d4, transparent 55%); }

.we-clock-noise{
  position:absolute; inset:0;
  opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.we-clock-wrap{
  position:relative;
  z-index:1;
  display:grid;
  gap:12px;
  color:#e5e7eb;
}

.we-clock-top{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  padding: 6px 2px;
}
.we-clock-kicker{ font-size:12px; opacity:.75; }
.we-clock-title{ font-size:20px; font-weight:950; color:#fff; margin-top:2px; }
.we-clock-sub{ font-size:12px; opacity:.78; margin-top:2px; }

.we-clock-pill{
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
  white-space:nowrap;
}
.we-clock-pill.open{
  background: rgba(34,197,94,.14);
  border-color: rgba(34,197,94,.28);
  color: #bbf7d0;
}
.we-clock-pill.off{
  background: rgba(244,63,94,.14);
  border-color: rgba(244,63,94,.28);
  color: #fecdd3;
}

.we-glass-card{
  background: rgba(255,255,255,.08) !important;
  border: 1px solid rgba(255,255,255,.16) !important;
  box-shadow: 0 30px 80px rgba(0,0,0,.35) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 18px !important;
}

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

.we-clock-label{
  font-size:12px;
  font-weight:800;
  opacity:.9;
  display:grid;
  gap:8px;
}

.we-clock-statusRow{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
}
.we-clock-statusLabel{ font-size:12px; opacity:.78; font-weight:800; }
.we-clock-statusValue{ font-size:22px; font-weight:950; color:#fff; margin-top:6px; line-height:1.15; }
.we-clock-statusMeta{ font-size:12px; opacity:.78; margin-top:6px; }

.we-clock-mini{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px 10px;
  border-radius:14px;
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.10);
  min-width: 165px;
}
.we-clock-miniDot{
  width:36px; height:36px;
  display:flex; align-items:center; justify-content:center;
  border-radius:12px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.12);
}
.we-clock-miniTop{ font-weight:900; font-size:12px; color:#fff; }
.we-clock-miniBot{ font-size:11px; opacity:.75; margin-top:2px; }

.we-clock-actions{ margin-top:12px; display:grid; gap:12px; }
.we-clock-btnRow{ display:flex; gap:10px; margin-top:12px; }
.we-clock-btnRow > *{ flex:1; }

.we-btn{
  width:100%;
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
}
.we-btn:hover{ filter: brightness(1.05); transform: translateY(-1px); }
.we-btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; }
.we-btn.danger{
  background: linear-gradient(135deg, rgba(244,63,94,1), rgba(236,72,153,1));
}

.we-btn-soft{
  width:100%;
  border-radius:14px;
  padding:12px 14px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  transition: background .12s ease, opacity .12s ease;
}
.we-btn-soft:hover{ background: rgba(255,255,255,.14); }
.we-btn-soft:disabled{ opacity:.55; cursor:not-allowed; }

.we-btn-spin{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
}
.spinner{
  width:16px;height:16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.5);
  border-top-color:#fff;
  animation:spin .9s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg);} }

.we-error{
  margin-top:12px;
  background: rgba(244,63,94,.14);
  border:1px solid rgba(244,63,94,.28);
  color:#fecdd3;
  border-radius:14px;
  padding:10px 12px;
  font-size:12px;
  font-weight:800;
  word-break: break-word;
}

.we-clock-recentHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  gap:10px;
  margin-bottom:10px;
}
.we-clock-recentTitle{ font-size:14px; font-weight:950; color:#fff; }
.we-clock-recentMeta{ font-size:12px; opacity:.75; }

.we-clock-empty{ font-size:13px; opacity:.78; }

.we-clock-list{ display:grid; gap:10px; }
.we-clock-item{
  padding:12px;
  border-radius:14px;
  background: rgba(15,23,42,.32);
  border:1px solid rgba(255,255,255,.12);
}
.we-clock-itemTop{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:flex-start;
}
.we-clock-itemId{ font-weight:950; color:#fff; }
.we-clock-itemNote{
  font-size:12px;
  opacity:.75;
  max-width: 230px;
  text-align:right;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.we-clock-itemGrid{
  margin-top:8px;
  font-size:12px;
  opacity:.9;
  display:grid;
  gap:6px;
}
.we-clock-strong{ font-weight:900; color:#fff; }

/* NEW */
.we-clock-locRow, .we-clock-locLine{
  margin-top:4px;
  font-size:12px;
  opacity:.9;
}
.we-clock-mapLink{
  margin-left:8px;
  font-size:12px;
  color:#a5b4fc;
  text-decoration:none;
}
.we-clock-mapLink:hover{ text-decoration:underline; }

@media (max-width: 420px){
  .we-clock-statusRow{
    flex-direction: column;
    align-items: stretch;
  }
  .we-clock-mini{
    min-width: 0;
    width: 100%;
  }
  .we-clock-btnRow{
    flex-direction: column;
  }
  .we-clock-itemNote{
    max-width: 160px;
  }
}
`;