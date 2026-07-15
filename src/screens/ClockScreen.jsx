// src/screens/ClockScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";
import { schedulesApi } from "../api/schedules";
import { getCurrentLocationDetails } from "../utils/location";
import { fmtDateTime, parseApiDate } from "../utils/datetime";
import WELogo from "../assets/welogo.png";
import ScheduleCalendarTab from "./ScheduleCalendarTab";
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

export function ClockScreen({ onAuthError, user }) {
  const [open, setOpen] = useState(null);
  const [recent, setRecent] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [currentGps, setCurrentGps] = useState(null);

  // OT
  const [otProjectName, setOtProjectName] = useState("");
  const [holidaySet, setHolidaySet] = useState(() => new Set()); // Set<YYYY-MM-DD>
  const [showOtManual, setShowOtManual] = useState(false);
  const [viewTab, setViewTab] = useState("clock");

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
    // OT after 17:30 (include 17:30 and above)
    return h > 17 || (h === 17 && m >= 30);
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

  async function refreshCurrentGps({ silent = true } = {}) {
    if (!silent) setGeoWarn("");
    try {
      const loc = await getCurrentLocationDetails({
        timeout: 6000,
        maximumAge: 30_000,
        enableHighAccuracy: true,
      });
      if (loc?.ok && loc.location) {
        setCurrentGps(loc.location);
        return;
      }
      if (loc?.code === "DENIED") setGeoPerm("denied");
      if (!silent && loc?.message) setGeoWarn(loc.message);
    } catch {
      if (!silent) setGeoWarn("Unable to capture current GPS.");
    }
  }

  async function refresh() {
    setErr("");
    refreshCurrentGps({ silent: true });
    try {
      const o = await attendanceApi.open();
      setOpen(o);

      const data = await attendanceApi.me();
      const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
      try {
        const sch = await schedulesApi.entries(todayKey, todayKey);
        setTodaySchedules(Array.isArray(sch) ? sch : []);
      } catch {
        setTodaySchedules([]);
      }

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
    refreshCurrentGps({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshCurrentGps({ silent: true });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  async function checkIn() {
    setBusy(true);
    setErr("");
    setSuccess("");
    setGeoWarn("");

    try {
      const loc = await getCurrentLocationDetails();
      if (!loc.ok || !loc.location) {
        if (loc.code === "DENIED") setGeoPerm("denied");
        setGeoWarn(loc.message || "Location is off — please enable it for accurate check-in.");
        setErr("Location is required for check-in. Please enable location and retry.");
        return;
      }
      setGeoPerm("granted");
      const location = loc.location;

      await attendanceApi.checkIn(note, location);

      setNote("");
      setOtProjectName("");
      setShowOtManual(false);

      await refresh();
      setSuccess("Check-in saved successfully.");
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
    setSuccess("");
    setGeoWarn("");

    try {
      const loc = await getCurrentLocationDetails();
      if (!loc.ok || !loc.location) {
        if (loc.code === "DENIED") setGeoPerm("denied");
        setGeoWarn(
          loc.message || "Location is off — please enable it for accurate check-out."
        );
        setErr("Location is required for check-out. Please enable location and retry.");
        return;
      }
      setGeoPerm("granted");
      const location = loc.location;

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
      setSuccess("Check-out saved successfully.");
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

  const schedulePreview = useMemo(() => todaySchedules.slice(0, 3), [todaySchedules]);
  const scheduleMoreCount = Math.max(todaySchedules.length - schedulePreview.length, 0);

  const showOtField = Boolean(open) && (otLikely || showOtManual);
  const currentGpsText = useMemo(
    () =>
      currentGps
        ? fmtLocation(
            currentGps.latitude,
            currentGps.longitude,
            currentGps.accuracyMeters
          )
        : "Waiting for GPS",
    [currentGps]
  );
  const hasCurrentGps = hasLatLng(currentGps?.latitude, currentGps?.longitude);
  const nextSchedule = schedulePreview[0] || null;
  const scheduleHeadline = nextSchedule
    ? `${nextSchedule.startTime}-${nextSchedule.endTime}`
    : "No schedule";
  const scheduleDetail = nextSchedule
    ? `${nextSchedule.workTitle || "Work"} @ ${nextSchedule.workLocation || "-"}`
    : "No assigned work items for today";

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
              <div className="we-clock-kicker">Attendance command center</div>
            </div>

            <div className="we-clock-title">Shift command center</div>
            <div className="we-clock-sub">{statusSub}</div>

            <div className="we-clock-nowRow">
              <span className="we-clock-chip live">
                <span className="ic">L</span> {formatLiveTime(now)}
              </span>
              <span className="we-clock-chip">
                <span className="ic">D</span> {formatFullDateDots(now)}
              </span>
            </div>
          </div>

          <span className={`we-clock-pill ${open ? "open" : "off"}`}>
            {open ? "OPEN" : "OFF"}
          </span>
        </div>

        <div className="we-clock-summaryGrid">
          <div className="we-clock-summaryCard">
            <div className="we-clock-summaryLabel">Session</div>
            <div className="we-clock-summaryValue">{open ? "Live" : "Ready"}</div>
            <div className="we-clock-summaryMeta">
              {open ? "Checked in and active now" : "Ready for first tap"}
            </div>
          </div>
          <div className="we-clock-summaryCard">
            <div className="we-clock-summaryLabel">Next block</div>
            <div className="we-clock-summaryValue">{scheduleHeadline}</div>
            <div className="we-clock-summaryMeta">{scheduleDetail}</div>
          </div>
          <div className="we-clock-summaryCard">
            <div className="we-clock-summaryLabel">GPS state</div>
            <div className="we-clock-summaryValue">{hasCurrentGps ? "Ready" : "Pending"}</div>
            <div className="we-clock-summaryMeta">
              {hasCurrentGps ? "Live location captured" : "Waiting for permission or fix"}
            </div>
          </div>
        </div>

        <div className="we-clock-segment">
          <button
            type="button"
            className={`we-clock-segBtn ${viewTab === "clock" ? "is-active" : ""}`}
            onClick={() => setViewTab("clock")}
          >
            Clock
          </button>
          <button
            type="button"
            className={`we-clock-segBtn ${viewTab === "calendar" ? "is-active" : ""}`}
            onClick={() => setViewTab("calendar")}
          >
            Calendar
          </button>
        </div>

        {viewTab === "clock" ? (
        <>
        {/* location warning */}
        {showLocationWarning ? (
          <div className="we-clock-warn">
            <div className="ic">!</div>
            <div className="txt">
              <div>Location access needs attention.</div>
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
          <div className="we-clock-heroCard">
            <div className="we-clock-statusTop">
              <div>
                <div className="we-clock-statusLabel">Live status</div>
                <div className="we-clock-statusValue">{statusText}</div>
                <div className="we-clock-statusMeta">
                  {open
                    ? "End your current session with live GPS capture."
                    : "Start your shift with one tap and live location."}
                </div>
              </div>

              <div className="we-clock-mini compact">
                <div className="we-clock-miniDot" aria-hidden="true">
                  {open ? "IN" : "ID"}
                </div>
                <div className="we-clock-miniText">
                  <div className="we-clock-miniTop">{open ? "Session active" : "Waiting"}</div>
                  <div className="we-clock-miniBot">
                    {open ? "Remember to close before leaving" : "Clock in when you start"}
                  </div>
                </div>
              </div>
            </div>

            <div className="we-clock-heroStats">
              <div className="we-clock-panel">
                <div className="we-clock-panelLabel">Current GPS</div>
                <div className="we-clock-panelValue">{hasCurrentGps ? "Live" : "Pending"}</div>
                <div className="we-clock-panelMeta">{currentGpsText}</div>
                {hasCurrentGps ? (
                  <a
                    className="we-clock-mapLink"
                    href={mapUrl(currentGps.latitude, currentGps.longitude)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open map
                  </a>
                ) : null}
              </div>
              <div className="we-clock-panel">
                <div className="we-clock-panelLabel">Today schedule</div>
                <div className="we-clock-panelValue">{todaySchedules.length}</div>
                <div className="we-clock-panelMeta">{scheduleDetail}</div>
              </div>
              <div className="we-clock-panel">
                <div className="we-clock-panelLabel">Overtime state</div>
                <div className="we-clock-panelValue">{otLikely ? "Watch" : "Normal"}</div>
                <div className="we-clock-panelMeta">
                  {otLikely ? "Project name may be required on checkout." : "Standard workday policy active."}
                </div>
              </div>
            </div>

            <div className="we-clock-actionBlock">
              <div className="we-clock-actionHead">
                <div>
                  <div className="we-clock-panelLabel">Primary action</div>
                  <div className="we-clock-actionTitle">{open ? "Check out" : "Check in"}</div>
                  <div className="we-clock-panelMeta">{statusSub}</div>
                </div>
                {showOtField ? (
                  <span className="we-clock-otBadge">OT {otRequired ? "Required" : "Optional"}</span>
                ) : null}
              </div>

              {!open ? (
                <div className="we-clock-actions">
                  <label className="we-clock-label">
                    Note (optional)
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">
                        N
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
                        <>Check in now</>
                      )}
                    </button>

                    <button className="we-btn-soft" onClick={refresh} disabled={busy}>
                      Refresh
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="we-clock-btnRow">
                    <button
                      className="we-btn danger"
                      onClick={checkOut}
                      disabled={busy}
                    >
                      {busy ? (
                        <span className="we-btn-spin">
                          <span className="spinner" />
                          Checking out…
                        </span>
                      ) : (
                        <>Check out now</>
                      )}
                    </button>

                    <button className="we-btn-soft" onClick={refresh} disabled={busy}>
                      Refresh
                    </button>
                  </div>

                  {showOtField ? (
                    <label className="we-clock-label">
                      OT Project {otRequired ? "(required)" : "(optional)"}
                      <div className={`we-input ${!otProjectOk ? "invalid" : ""}`}>
                        <span className="we-icon" aria-hidden="true">
                          OT
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
                            ? "OT likely detected. Fill this before checkout."
                            : "Required: enter OT Project name."}
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
                        Add OT project
                      </button>
                    </div>
                  )}

                  {canNoOtCheckout ? (
                    <div className="we-clock-noOt">
                      <button
                        type="button"
                        className="we-btn-soft"
                        onClick={() => checkOut(true)}
                        disabled={busy}
                      >
                        No OT checkout
                      </button>
                      <div className="we-clock-noOtHint">
                        Use this if you are not claiming OT. Checkout between 17:00-17:29 is stored as 17:00.
                      </div>
                    </div>
                  ) : null}

                  <div className="we-fieldHint" style={{ marginTop: 10 }}>
                    Clock-out policy: 17:00-17:29 records as 17:00, 17:30 and later counts as OT. If still open next day without overnight approval, system auto-closes at 17:00.
                  </div>
                </>
              )}
            </div>

            <div className="we-clock-detailGrid">
              <div className="we-clock-panel we-clock-panelWide">
                <div className="we-clock-panelLabel">Today plan</div>
                {todaySchedules.length === 0 ? (
                  <div className="we-clock-locSub">No schedule today</div>
                ) : (
                  <>
                    <ul className="we-clock-scheduleList">
                      {schedulePreview.map((s) => (
                        <li key={s.id}>
                          <span className="time">{s.startTime}-{s.endTime}</span>
                          <span className="task">{s.workTitle || "Work"}</span>
                          <span className="place">@ {s.workLocation || "-"}</span>
                        </li>
                      ))}
                    </ul>
                    {scheduleMoreCount > 0 ? (
                      <div className="we-clock-locSub">+{scheduleMoreCount} more items today</div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="we-clock-panel">
                <div className="we-clock-panelLabel">Check-in source</div>
                <div className="we-clock-panelMeta">
                  {openLocText || "A saved check-in location will appear here after you clock in."}
                </div>
                {open && hasLatLng(open.checkInLat, open.checkInLng) ? (
                  <a
                    className="we-clock-mapLink"
                    href={mapUrl(open.checkInLat, open.checkInLng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open check-in map
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {success ? <div className="we-success">{success}</div> : null}
          {err ? <div className="we-error">{err}</div> : null}
        </Card>

        {/* recent activity (today only) */}
        <Card className="we-glass-card">
          <div className="we-clock-recentHead">
            <div className="we-clock-recentTitle">Recent activity</div>
            <div className="we-clock-recentMeta">
              Today only / {formatFullDateDots(now)} /{" "}
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
                    <div className="we-clock-itemId">Record #{r.id}</div>
                    <div className="we-clock-itemNote">
                      {r.note ? r.note : ""}
                    </div>
                  </div>

                  <div className="we-clock-itemGrid">
                    <div>
                      <span className="we-clock-strong">In:</span>{" "}
                      {fmtDateTime(r.checkInAt)}
                    </div>
                    <div>
                      <span className="we-clock-strong">Out:</span>{" "}
                      {fmtDateTime(r.checkOutAt)}
                    </div>

                    <div className="we-clock-locRow">
                      <span className="we-clock-strong">In loc:</span>{" "}
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
                      <span className="we-clock-strong">Out loc:</span>{" "}
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
        </>
        ) : (
          <ScheduleCalendarTab user={user} onAuthError={onAuthError} />
        )}
      </div>
    </div>
  );
}
