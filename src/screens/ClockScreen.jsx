// src/screens/ClockScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";
import { getCurrentLocation } from "../utils/location";
import { fmtDateTime } from "../utils/datetime";
import WELogo from "../assets/WE.png";
import "./ClockScreen.css";

function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatFullDateDots(d = new Date()) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(d);
  const day = new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(d);
  const year = new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(d);
  return `${weekday} . ${month} . ${day} . ${year}`;
}

function formatLiveTime(d = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

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

  // ✅ Live clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ CSS expects is-day / is-night
  const themeClass = useMemo(() => {
    const h = now.getHours();
    return h >= 6 && h < 18 ? "is-day" : "is-night";
  }, [now]);

  // ✅ Today-only key (update when date changes)
  const todayKey = useMemo(() => localIsoDate(now), [now]);

  // ✅ Location permission warning
  const [geoPerm, setGeoPerm] = useState("unknown"); // unknown | granted | prompt | denied
  const [geoWarn, setGeoWarn] = useState(""); // message string or empty

  useEffect(() => {
    let mounted = true;

    async function checkGeoPermission() {
      try {
        // Permissions API (works on most modern browsers)
        if (!navigator?.permissions?.query) return;
        const p = await navigator.permissions.query({ name: "geolocation" });
        if (!mounted) return;
        setGeoPerm(p.state);

        const onChange = () => mounted && setGeoPerm(p.state);
        p.addEventListener?.("change", onChange);
        return () => p.removeEventListener?.("change", onChange);
      } catch {
        // ignore
      }
    }

    const cleanupPromise = checkGeoPermission();
    return () => {
      mounted = false;
      // if query returned cleanup
      if (cleanupPromise && typeof cleanupPromise.then === "function") {
        cleanupPromise.then((fn) => typeof fn === "function" && fn());
      }
    };
  }, []);

  const showLocationWarning =
    geoPerm === "denied" || geoPerm === "prompt" || Boolean(geoWarn);

  async function refresh() {
    setErr("");
    try {
      const o = await attendanceApi.open();
      setOpen(o);

      const rows = await attendanceApi.me();

      // ✅ Today-only recent activity
      const todayRows = (rows || []).filter((r) => {
        const dt = r?.checkInAt || r?.createdAt || r?.timestamp;
        if (!dt) return false;
        return localIsoDate(new Date(dt)) === todayKey;
      });

      setRecent(todayRows.slice(0, 8));
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
    setGeoWarn("");

    try {
      const location = await getCurrentLocation(); // may be null
      if (!location) {
        setGeoWarn("Location is off — please enable it for accurate check-in.");
      }

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
    setGeoWarn("");

    try {
      const location = await getCurrentLocation(); // may be null
      if (!location) {
        setGeoWarn("Location is off — please enable it for accurate check-out.");
      }

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

  const openLocText = useMemo(() => {
    if (!open) return null;
    const t = fmtLocation(open.checkInLat, open.checkInLng, open.checkInAccuracyMeters);
    return t === "—" ? null : t;
  }, [open]);

  return (
    <div className={`we-clock-root ${themeClass}`}>
      {/* background */}
      <div className="we-clock-bg" aria-hidden="true">
        <div className="we-clock-blob we-clock-blob-1" />
        <div className="we-clock-blob we-clock-blob-2" />
        <div className="we-clock-blob we-clock-blob-3" />
        <div className="we-clock-noise" />
      </div>

      <div className="we-clock-wrap">
        {/* header */}
        <div className="we-clock-top">
          <div>
            {/* ✅ WE logo */}
            <div className="we-clock-logoRow">
              <img className="we-clock-logo" src={WELogo} alt="WE" />
              <div className="we-clock-kicker">⏱️ Clock in / out</div>
            </div>

            <div className="we-clock-title">{statusText}</div>
            <div className="we-clock-sub">
              {open ? "✅ You are currently checked in." : "🌙 You are currently not checked in."}
            </div>

            {/* ✅ Use CSS classes from ClockScreen.css */}
            <div className="we-clock-nowRow">
              <span className="we-clock-chip live">
                <span className="ic">🕒</span> {formatLiveTime(now)}
              </span>
              <span className="we-clock-chip">
                <span className="ic">📅</span> {formatFullDateDots(now)}
              </span>
            </div>
          </div>

          <span className={`we-clock-pill ${open ? "open" : "off"}`}>
            {open ? "OPEN" : "OFF"}
          </span>
        </div>

        {/* ✅ Location warning banner */}
        {showLocationWarning ? (
          <div className="we-clock-warn">
            <div className="ic">⚠️</div>
            <div className="txt">
              <div>Location is not enabled.</div>
              <div className="hint">
                {geoPerm === "denied"
                  ? "Permission denied — turn on location in browser settings."
                  : geoWarn || "Enable location for accurate clock in/out and map links."}
              </div>
            </div>
          </div>
        ) : null}

        {/* status */}
        <Card className="we-glass-card">
          <div className="we-clock-statusRow">
            <div className="we-clock-statusText">
              <div className="we-clock-statusLabel">📌 Status</div>
              <div className="we-clock-statusValue">{statusText}</div>
              <div className="we-clock-statusMeta">{statusSub}</div>

              {open && openLocText ? (
                <div className="we-clock-locLine">
                  <span className="we-clock-strong">📍 Check-in loc:</span> {openLocText}{" "}
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
                <div className="we-clock-miniBot">
                  {open ? "Don’t forget to check out" : "Ready when you are"}
                </div>
              </div>
            </div>
          </div>

          {!open ? (
            <div className="we-clock-actions">
              <label className="we-clock-label">
                📝 Note (optional)
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
                    <>✅ Check in</>
                  )}
                </button>

                <button className="we-btn-soft" onClick={refresh} disabled={busy}>
                  🔄 Refresh
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
                  <>⏹️ Check out</>
                )}
              </button>

              <button className="we-btn-soft" onClick={refresh} disabled={busy}>
                🔄 Refresh
              </button>
            </div>
          )}

          {err ? <div className="we-error">{err}</div> : null}
        </Card>

        {/* recent (today only) */}
        <Card className="we-glass-card">
          <div className="we-clock-recentHead">
            <div className="we-clock-recentTitle">📜 Recent activity</div>
            <div className="we-clock-recentMeta">
              Today only • {formatFullDateDots(now)} • {Math.min(8, recent.length)} records
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="we-clock-empty">No records for today.</div>
          ) : (
            <div className="we-clock-list">
              {recent.map((r) => (
                <div key={r.id} className="we-clock-item">
                  <div className="we-clock-itemTop">
                    <div className="we-clock-itemId">🧾 #{r.id}</div>
                    <div className="we-clock-itemNote">{r.note ? `📝 ${r.note}` : ""}</div>
                  </div>

                  <div className="we-clock-itemGrid">
                    <div>
                      <span className="we-clock-strong">➡️ In:</span> {fmtDateTime(r.checkInAt)}
                    </div>
                    <div>
                      <span className="we-clock-strong">⬅️ Out:</span> {fmtDateTime(r.checkOutAt)}
                    </div>

                    <div className="we-clock-locRow">
                      <span className="we-clock-strong">📍 In loc:</span>{" "}
                      {fmtLocation(r.checkInLat, r.checkInLng, r.checkInAccuracyMeters)}{" "}
                      {hasLatLng(r.checkInLat, r.checkInLng) ? (
                        <a className="we-clock-mapLink" href={mapUrl(r.checkInLat, r.checkInLng)} target="_blank" rel="noreferrer">
                          Map
                        </a>
                      ) : null}
                    </div>

                    <div className="we-clock-locRow">
                      <span className="we-clock-strong">📍 Out loc:</span>{" "}
                      {fmtLocation(r.checkOutLat, r.checkOutLng, r.checkOutAccuracyMeters)}{" "}
                      {hasLatLng(r.checkOutLat, r.checkOutLng) ? (
                        <a className="we-clock-mapLink" href={mapUrl(r.checkOutLat, r.checkOutLng)} target="_blank" rel="noreferrer">
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
    </div>
  );
}