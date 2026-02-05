// src/screens/ClockScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";
import { getCurrentLocation } from "../utils/location";
import { fmtDateTime, parseApiDate } from "../utils/datetime";
import WELogo from "../assets/WE.png";
import "./ClockScreen.css";

const SG_TZ = "Asia/Singapore";

function localIsoDate(d = new Date()) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  // en-CA gives YYYY-MM-DD format
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SG_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function formatFullDateDots(d = new Date()) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    d
  );
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

  // OT
  const [otProjectName, setOtProjectName] = useState("");
  const [holidaySet, setHolidaySet] = useState(() => new Set()); // Set<YYYY-MM-DD>
  const [showOtManual, setShowOtManual] = useState(false);

  // ✅ Live clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ CSS expects is-day / is-night
  const themeClass = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: SG_TZ,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    return h >= 6 && h < 18 ? "is-day" : "is-night";
  }, [now]);

  // ✅ Today-only key
  const todayKey = useMemo(() => localIsoDate(now), [now]);

  // ✅ Load holidays for current year (used to detect OT)
  useEffect(() => {
    let cancelled = false;

    async function loadHolidays() {
      try {
        const y = now.getFullYear();
        const list = await attendanceApi.holidays(y);
        const set = new Set(
          (Array.isArray(list) ? list : [])
            .map((h) => String(h?.date ?? h?.Date ?? "").slice(0, 10))
            .filter(Boolean)
        );
        if (!cancelled) setHolidaySet(set);
      } catch {
        // ignore (OT still works with time + Sunday)
      }
    }

    loadHolidays();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.getFullYear()]);

  const isSunday = useMemo(() => {
    const w = new Intl.DateTimeFormat("en-US", { timeZone: SG_TZ, weekday: "short" }).format(now);
    return w == "Sun";
  }, [now]);
  const isHoliday = useMemo(() => holidaySet.has(todayKey), [holidaySet, todayKey]);
  const isWorkday = useMemo(() => !isSunday && !isHoliday, [isSunday, isHoliday]);

  const isAfterShiftEnd = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: SG_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    // OT after 17:00 (include 17:00 and above)
    return h > 17 || (h === 17 && m >= 0);
  }, [now]);

  // ✅ OT detection (time OR sunday OR holiday)
  const otLikely = useMemo(() => isAfterShiftEnd || isSunday || isHoliday, [
    isAfterShiftEnd,
    isSunday,
    isHoliday,
  ]);

  // ✅ OT required only when user is currently OPEN (checked in)
  const otRequired = useMemo(() => Boolean(open) && otLikely, [open, otLikely]);
  const canNoOtCheckout = useMemo(
    () => Boolean(open) && isWorkday && isAfterShiftEnd,
    [open, isWorkday, isAfterShiftEnd]
  );

  const otProjectOk = useMemo(() => {
    if (!otRequired) return true;
    return (otProjectName || "").trim().length > 0;
  }, [otRequired, otProjectName]);

  // ✅ Location permission warning
  const [geoPerm, setGeoPerm] = useState("unknown"); // unknown | granted | prompt | denied
  const [geoWarn, setGeoWarn] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkGeoPermission() {
      try {
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

      const data = await attendanceApi.me();
      const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];

      // ✅ Today-only recent activity (timezone-safe)
      const todayRows = (rows || []).filter((r) => {
        const dt = r?.checkInAt || r?.createdAt || r?.timestamp;
        if (!dt) return false;

        const d = parseApiDate(dt);
        if (!d) return false;

        return localIsoDate(d) === todayKey;
      });

      todayRows.sort((a, b) => {
        const ta = parseApiDate(a?.checkInAt || a?.createdAt || a?.timestamp)?.getTime() ?? 0;
        const tb = parseApiDate(b?.checkInAt || b?.createdAt || b?.timestamp)?.getTime() ?? 0;
        return tb - ta;
      });

      setRecent(todayRows.slice(0, 8));
    } catch (e) {
      const msg = e?.message || "Failed to load";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
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
      const location = await getCurrentLocation();
      if (!location) {
        setGeoWarn("Location is off — please enable it for accurate check-in.");
      }

      await attendanceApi.checkIn(note, location);

      setNote("");
      setOtProjectName("");
      setShowOtManual(false);

      await refresh();
    } catch (e) {
      const msg = e?.message || "Check-in failed";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function checkOut(forceNoOt = false) {
    setBusy(true);
    setErr("");
    setGeoWarn("");

    try {
      const location = await getCurrentLocation();
      if (!location) {
        setGeoWarn(
          "Location is off — please enable it for accurate check-out."
        );
      }

      const project = (otProjectName || "").trim();
      const noOt = forceNoOt === true;

      // ✅ Frontend guard: require OT project if OT required (unless user chooses no-OT checkout)
      if (!noOt && otRequired && !project) {
        setErr("OT detected. Please enter OT Project name before checkout.");
        setShowOtManual(true);
        return;
      }

      await attendanceApi.checkOut(location, project, noOt);

      setOtProjectName("");
      setShowOtManual(false);

      await refresh();
    } catch (e) {
      const msg = e?.message || "Check-out failed";

      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();

      // Overnight approval (backend returns 409)
      if (String(msg).includes("409")) {
        setErr("Overnight checkout pending admin approval.");
        await refresh();
        return;
      }

      // Backend OT missing project (400)
      if (String(msg).toLowerCase().includes("ot detected")) {
        setErr("OT detected. Please enter OT Project name before checkout.");
        setShowOtManual(true);
        return;
      }

      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const statusText = useMemo(
    () => (open ? "Checked in" : "Not checked in"),
    [open]
  );

  const statusSub = useMemo(
    () =>
      open ? `Since ${fmtDateTime(open.checkInAt)}` : "Tap check in to start",
    [open]
  );

  const openLocText = useMemo(() => {
    if (!open) return null;
    const t = fmtLocation(
      open.checkInLat,
      open.checkInLng,
      open.checkInAccuracyMeters
    );
    return t === "—" ? null : t;
  }, [open]);

  const showOtField = Boolean(open) && (otLikely || showOtManual);

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
            <div className="we-clock-logoRow">
              <img className="we-clock-logo" src={WELogo} alt="WE" />
              <div className="we-clock-kicker">⏱️ Clock in / out</div>
            </div>

            <div className="we-clock-title">{statusText}</div>
            <div className="we-clock-sub">
              {open
                ? "✅ You are currently checked in."
                : "🌙 You are currently not checked in."}
            </div>

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

        {/* location warning */}
        {showLocationWarning ? (
          <div className="we-clock-warn">
            <div className="ic">⚠️</div>
            <div className="txt">
              <div>Location is not enabled.</div>
              <div className="hint">
                {geoPerm === "denied"
                  ? "Permission denied — turn on location in browser settings."
                  : geoWarn ||
                    "Enable location for accurate clock in/out and map links."}
              </div>
            </div>
          </div>
        ) : null}

        {/* status card */}
        <Card className="we-glass-card">
          <div className="we-clock-statusRow">
            <div className="we-clock-statusText">
              <div className="we-clock-statusLabel">📌 Status</div>
              <div className="we-clock-statusValue">{statusText}</div>
              <div className="we-clock-statusMeta">{statusSub}</div>

              {open && openLocText ? (
                <div className="we-clock-locLine">
                  <span className="we-clock-strong">📍 Check-in loc:</span>{" "}
                  {openLocText}{" "}
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

          {/* ACTIONS */}
          {!open ? (
            <div className="we-clock-actions">
              <label className="we-clock-label">
                📝 Note (optional)
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">
                    📝
                  </span>
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
            <>
              {/* OT field (auto show if OT likely OR manual open) */}
              {showOtField ? (
                <label className="we-clock-label">
                  🧾 OT Project {otRequired ? "(required)" : "(optional)"}
                  <div className={`we-input ${!otProjectOk ? "invalid" : ""}`}>
                    <span className="we-icon" aria-hidden="true">
                      🏗️
                    </span>
                    <input
                      value={otProjectName}
                      onChange={(e) => setOtProjectName(e.target.value)}
                      placeholder="e.g. ARTC L5 FCU install"
                      disabled={busy}
                    />
                  </div>

                  {otRequired ? (
                    <div className={`we-fieldHint ${!otProjectOk ? "warn" : ""}`}>
                      {otProjectOk
                        ? "OT likely detected. Please fill this before checkout."
                        : "Required: please enter OT Project name."}
                    </div>
                  ) : (
                    <div className="we-fieldHint">Optional. Fill only if you are doing OT.</div>
                  )}
                </label>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="we-btn-soft"
                    onClick={() => setShowOtManual(true)}
                    disabled={busy}
                  >
                    ➕ Add OT project
                  </button>
                </div>
              )}

              <div className="we-clock-btnRow">
                <button
                  className="we-btn danger"
                  onClick={checkOut}
                  disabled={busy || !otProjectOk}
                >
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

              {canNoOtCheckout ? (
                <div className="we-clock-noOt">
                  <button
                    type="button"
                    className="we-btn-soft"
                    onClick={() => checkOut(true)}
                    disabled={busy}
                  >
                    ⛔ No OT — Check out
                  </button>
                  <div className="we-clock-noOtHint">
                    Use this if you are not claiming OT. We'll use standard end time (no OT).
                  </div>
                </div>
              ) : null}
            </>
          )}

          {err ? <div className="we-error">{err}</div> : null}
        </Card>

        {/* recent activity (today only) */}
        <Card className="we-glass-card">
          <div className="we-clock-recentHead">
            <div className="we-clock-recentTitle">📜 Recent activity</div>
            <div className="we-clock-recentMeta">
              Today only • {formatFullDateDots(now)} •{" "}
              {Math.min(8, recent.length)} records
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
                    <div className="we-clock-itemNote">
                      {r.note ? `📝 ${r.note}` : ""}
                    </div>
                  </div>

                  <div className="we-clock-itemGrid">
                    <div>
                      <span className="we-clock-strong">➡️ In:</span>{" "}
                      {fmtDateTime(r.checkInAt)}
                    </div>
                    <div>
                      <span className="we-clock-strong">⬅️ Out:</span>{" "}
                      {fmtDateTime(r.checkOutAt)}
                    </div>

                    <div className="we-clock-locRow">
                      <span className="we-clock-strong">📍 In loc:</span>{" "}
                      {fmtLocation(
                        r.checkInLat,
                        r.checkInLng,
                        r.checkInAccuracyMeters
                      )}{" "}
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
                      {fmtLocation(
                        r.checkOutLat,
                        r.checkOutLng,
                        r.checkOutAccuracyMeters
                      )}{" "}
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
    </div>
  );
}