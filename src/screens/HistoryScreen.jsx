// src/screens/HistoryScreen.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attendanceApi } from "../api/attendance";
import { fmtDateTime, parseApiDate } from "../utils/datetime";
import "./HistoryScreen.css";

/** Business rules (Singapore) */
const ON_TIME_HOUR = 8;
const ON_TIME_MINUTE = 15;
const SG_TZ = "Asia/Singapore";

/** Utils */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/**
 * ✅ Always compute calendar date as Singapore date (YYYY-MM-DD),
 * regardless of user's device timezone.
 */
function isoDateInSg(date) {
  if (!isValidDate(date)) return "";
  // en-CA gives YYYY-MM-DD format
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SG_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * ✅ Convert a YYYY-MM-DD to a UTC millisecond range representing Singapore day.
 * Singapore is fixed +08:00 (no DST). So:
 * SG 00:00 = UTC 16:00 previous day.
 */
function sgDayRangeUtcMs(isoDay) {
  if (!isoDay) return null;
  const [y, m, d] = isoDay.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;

  const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - SG_OFFSET_MS;
  const endUtcMsExclusive = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - SG_OFFSET_MS;
  return { startUtcMs, endUtcMsExclusive };
}

/** Validate yyyy-mm-dd */
function parseIsoDateInput(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function prettyDate(dayKey) {
  const r = sgDayRangeUtcMs(dayKey);
  if (!r) return dayKey;

  // Use SG noon for stable formatting
  const noonUtcMs = r.startUtcMs + 12 * 60 * 60 * 1000;
  const d = new Date(noonUtcMs);
  if (!isValidDate(d)) return dayKey;

  const w = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: SG_TZ }).format(d);
  const md = new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", timeZone: SG_TZ }).format(d);
  const y = new Intl.DateTimeFormat(undefined, { year: "numeric", timeZone: SG_TZ }).format(d);
  return `${w} · ${md}, ${y}`;
}

function weekdayShort(dayKey) {
  const r = sgDayRangeUtcMs(dayKey);
  if (!r) return dayKey;
  const noonUtcMs = r.startUtcMs + 12 * 60 * 60 * 1000;
  const d = new Date(noonUtcMs);
  if (!isValidDate(d)) return dayKey;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: SG_TZ }).format(d);
}

/**
 * ✅ Iterate days between two ISO dates (inclusive).
 * This walks calendar days, safe across months/years.
 */
function daysBetweenInclusiveIso(fromIso, toIso) {
  const out = [];
  const a = parseIsoDateInput(fromIso);
  const b = parseIsoDateInput(toIso);
  if (!a || !b) return out;

  let cur = new Date(Date.UTC(a.y, a.m - 1, a.d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(b.y, b.m - 1, b.d, 0, 0, 0, 0));

  while (cur.getTime() <= end.getTime()) {
    const iso = `${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`;
    out.push(iso);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function monthRangeIso(baseDate) {
  const baseIso = isoDateInSg(baseDate);
  const a = parseIsoDateInput(baseIso);
  if (!a) return { fromIso: "", toIso: "" };

  const y = a.y;
  const m = a.m;

  const fromIso = `${y}-${pad2(m)}-01`;

  // last day of month
  const lastDay = new Date(Date.UTC(y, m, 0));
  const toIso = `${y}-${pad2(m)}-${pad2(lastDay.getUTCDate())}`;

  return { fromIso, toIso };
}

function weekRangeIso(baseDate) {
  const baseIso = isoDateInSg(baseDate);
  const a = parseIsoDateInput(baseIso);
  if (!a) return { fromIso: "", toIso: "" };

  const noon = new Date(Date.UTC(a.y, a.m - 1, a.d, 12, 0, 0));
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: SG_TZ, weekday: "short" }).format(noon);
  const mapDow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const back = mapDow[dow] ?? 0;

  const start = new Date(Date.UTC(a.y, a.m - 1, a.d, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - back);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const fromIso = `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}-${pad2(start.getUTCDate())}`;
  const toIso = `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}`;
  return { fromIso, toIso };
}

function prevMonthRangeIso(baseDate) {
  const baseIso = isoDateInSg(baseDate);
  const a = parseIsoDateInput(baseIso);
  if (!a) return { fromIso: "", toIso: "" };

  let y = a.y;
  let m = a.m - 1;
  if (m <= 0) {
    m = 12;
    y -= 1;
  }

  const fromIso = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0));
  const toIso = `${y}-${pad2(m)}-${pad2(lastDay.getUTCDate())}`;

  return { fromIso, toIso };
}

function isLate(checkInAt) {
  const d = parseApiDate(checkInAt);
  if (!d) return false;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SG_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return hh > ON_TIME_HOUR || (hh === ON_TIME_HOUR && mm > ON_TIME_MINUTE);
}

/**
 * ✅ Use backend OT minutes if provided.
 * Fallback only if old records don't have it.
 */
function getOtMinutesFromRow(r, isWorkdayDay) {
  if (typeof r?.otMinutes === "number") return Math.max(0, r.otMinutes);

  const inD = parseApiDate(r?.checkInAt);
  const outD = parseApiDate(r?.checkOutAt);
  if (!inD || !outD) return 0;

  if (!isWorkdayDay) {
    const diff = Math.max(0, outD.getTime() - inD.getTime());
    return Math.round(diff / 60000);
  }

  const inIso = isoDateInSg(inD);
  const r0 = sgDayRangeUtcMs(inIso);
  if (!r0) return 0;

  const cutoffUtcMs = r0.startUtcMs + 17 * 60 * 60 * 1000; // 17:00 SG
  const extra = Math.max(0, outD.getTime() - cutoffUtcMs);
  return Math.round(extra / 60000);
}

/**
 * ✅ Duration displayed = net worked minutes if available.
 * Prefer backend: regular + ot (lunch already deducted in those mins)
 */
function getWorkedMinutesFromRow(r) {
  const reg = typeof r?.regularMinutes === "number" ? r.regularMinutes : null;
  const ot = typeof r?.otMinutes === "number" ? r.otMinutes : null;
  if (reg != null && ot != null) return Math.max(0, reg + ot);

  const inD = parseApiDate(r?.checkInAt);
  const outD = parseApiDate(r?.checkOutAt);
  if (!inD || !outD) return null;

  const mins = Math.round((outD.getTime() - inD.getTime()) / 60000);
  return mins >= 0 ? mins : null;
}

function formatHm(mins) {
  const m0 = Math.max(0, mins || 0);
  const rounded = Math.round(m0 / 15) * 15;
  const h = Math.floor(rounded / 60);
  const mm = rounded % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

function formatHShort(mins) {
  const m = Math.max(0, mins || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}.${Math.round((mm / 60) * 10)}h`;
}

export function HistoryScreen({ onAuthError }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ✅ Default range = this week (by SG date)
  const currentWeek = useMemo(() => weekRangeIso(now), [now]);
  const [fromIso, setFromIso] = useState(() => currentWeek.fromIso);
  const [toIso, setToIso] = useState(() => currentWeek.toIso);

  // Auto-shift if week changed and user still default
  useEffect(() => {
    const expectedFrom = currentWeek.fromIso;
    const expectedTo = currentWeek.toIso;

    const isStillDefault =
      fromIso === weekRangeIso(now).fromIso && toIso === weekRangeIso(now).toIso;

    if (isStillDefault) {
      setFromIso(expectedFrom);
      setToIso(expectedTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek.fromIso, currentWeek.toIso]);

  // Holidays: Map<year, Set<YYYY-MM-DD>>
  const [holidaySets, setHolidaySets] = useState(() => new Map());
  const loadedYearsRef = useRef(new Set());

  const refresh = useCallback(async () => {
    setErr("");
    setBusy(true);
    try {
      const data = await attendanceApi.me();
      const list = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];

      list.sort((a, b) => {
        const ta = parseApiDate(a.checkInAt)?.getTime() ?? 0;
        const tb = parseApiDate(b.checkInAt)?.getTime() ?? 0;
        return tb - ta;
      });

      setRows(list);
    } catch (e) {
      const msg = e?.message || "Failed to load history";
      if (String(msg).includes("401") || String(msg).includes("403")) {
        return onAuthError?.();
      }
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }, [onAuthError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ✅ Range selected in SG calendar days
  const rangeSelected = useMemo(() => {
    if (!fromIso || !toIso) return { fromIso: null, toIso: null };
    if (fromIso > toIso) return { fromIso: toIso, toIso: fromIso };
    return { fromIso, toIso };
  }, [fromIso, toIso]);

  // ✅ Filter rows by SG day range using UTC milliseconds
  const rowsInRange = useMemo(() => {
    const { fromIso: f, toIso: t } = rangeSelected;
    if (!f || !t) return rows;

    const fr = sgDayRangeUtcMs(f);
    const tr = sgDayRangeUtcMs(t);
    if (!fr || !tr) return rows;

    const startUtcMs = fr.startUtcMs;
    const endUtcMsExclusive = tr.endUtcMsExclusive;

    return rows.filter((r) => {
      const d = parseApiDate(r?.checkInAt);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= startUtcMs && ms < endUtcMsExclusive;
    });
  }, [rows, rangeSelected]);

  // ✅ Load holidays for years in selected range (+ current year)
  useEffect(() => {
    let cancelled = false;

    const years = new Set();
    const nowSgIso = isoDateInSg(now);
    const nowY = Number(nowSgIso.slice(0, 4));
    years.add(nowY);

    const { fromIso: f, toIso: t } = rangeSelected;
    if (f && t) {
      const fy = Number(f.slice(0, 4));
      const ty = Number(t.slice(0, 4));
      for (let y = fy; y <= ty; y += 1) years.add(y);
    }

    async function fetchYear(y) {
      try {
        const list = await attendanceApi.holidays(y);
        const set = new Set(
          (Array.isArray(list) ? list : [])
            .map((h) => String(h?.date ?? h?.Date ?? "").slice(0, 10))
            .filter(Boolean),
        );

        if (cancelled) return;

        setHolidaySets((prev) => {
          const next = new Map(prev);
          next.set(y, set);
          return next;
        });
      } catch {
        // ignore
      }
    }

    for (const y of years) {
      if (loadedYearsRef.current.has(y)) continue;
      loadedYearsRef.current.add(y);
      fetchYear(y);
    }

    return () => {
      cancelled = true;
    };
  }, [rangeSelected, now]);

  const isHolidayIso = useCallback(
    (iso) => {
      const y = Number(String(iso).slice(0, 4));
      const set = holidaySets.get(y);
      if (!set) return false;
      return set.has(iso);
    },
    [holidaySets],
  );

  const isWorkdayIso = useCallback(
    (iso) => {
      const r = sgDayRangeUtcMs(iso);
      if (!r) return true;
      const noon = new Date(r.startUtcMs + 12 * 60 * 60 * 1000);

      const dow = new Intl.DateTimeFormat("en-US", { timeZone: SG_TZ, weekday: "short" }).format(noon);
      if (dow === "Sun") return false;
      if (isHolidayIso(iso)) return false;
      return true; // Mon–Sat
    },
    [isHolidayIso],
  );

  const rangeText = useMemo(() => {
    const { fromIso: f, toIso: t } = rangeSelected;
    if (!f || !t) return "—";
    return `${f} → ${t}`;
  }, [rangeSelected]);

  // ✅ Stats (use backend minutes!)
  const stats = useMemo(() => {
    const sessions = rowsInRange.length;
    const open = rowsInRange.filter((r) => !r.checkOutAt).length;

    const attendedWorkdayKeys = new Set();
    let onTimeWorkdaySessions = 0;
    let lateWorkdaySessions = 0;

    let offDaySessions = 0;
    const offDayWorkedKeys = new Set();
    let overtimeAll = 0;
    let overtimeOffDays = 0;
    let overtimeWorkdays = 0;

    for (const r of rowsInRange) {
      const inD = parseApiDate(r.checkInAt);
      if (!inD) continue;

      const dk = isoDateInSg(inD);
      const wd = isWorkdayIso(dk);

      if (wd) {
        attendedWorkdayKeys.add(dk);
        if (isLate(r.checkInAt)) lateWorkdaySessions += 1;
        else onTimeWorkdaySessions += 1;
      } else {
        offDaySessions += 1;
        offDayWorkedKeys.add(dk);
      }

      if (r.checkOutAt) {
        const ot = getOtMinutesFromRow(r, wd);
        overtimeAll += ot;
        if (wd) overtimeWorkdays += ot;
        else overtimeOffDays += ot;
      }
    }

    let expectedWorkdays = 0;
    if (rangeSelected.fromIso && rangeSelected.toIso) {
      const dayIsos = daysBetweenInclusiveIso(rangeSelected.fromIso, rangeSelected.toIso);
      expectedWorkdays = dayIsos.filter(isWorkdayIso).length;
    }

    const workingDays = attendedWorkdayKeys.size;
    const absent = Math.max(0, expectedWorkdays - workingDays);

    const denom = Math.max(1, onTimeWorkdaySessions + lateWorkdaySessions);
    const onTimePct = Math.round((onTimeWorkdaySessions / denom) * 100);

    return {
      sessions,
      open,
      workingDays,
      expectedWorkdays,
      absent,
      onTimeWorkdaySessions,
      lateWorkdaySessions,
      onTimePct,
      overtimeMinutes: overtimeAll,
      overtimeWorkMinutes: overtimeWorkdays,
      overtimeOffMinutes: overtimeOffDays,
      offDayWorkedDays: offDayWorkedKeys.size,
      offDaySessions,
    };
  }, [rowsInRange, isWorkdayIso, rangeSelected]);

  const overviewDonuts = useMemo(() => {
    const workdayDenom = Math.max(1, stats.onTimeWorkdaySessions + stats.lateWorkdaySessions);
    const onTimePct = Math.round((stats.onTimeWorkdaySessions / workdayDenom) * 100);
    const latePct = Math.max(0, 100 - onTimePct);

    const coveragePct =
      stats.expectedWorkdays > 0 ? Math.round((stats.workingDays / stats.expectedWorkdays) * 100) : 0;

    const otWorkPct =
      stats.overtimeMinutes > 0
        ? Math.round((stats.overtimeWorkMinutes / stats.overtimeMinutes) * 100)
        : 0;
    const otOffPct = stats.overtimeMinutes > 0 ? Math.max(0, 100 - otWorkPct) : 0;

    return {
      onTimePct,
      latePct,
      coveragePct,
      otWorkPct,
      otOffPct,
    };
  }, [stats]);

  /**
   * ✅ Daily report = THIS WEEK (Sun → Sat) in Singapore
   */
  const daily = useMemo(() => {
    const todayIso = isoDateInSg(now);
    const todayRange = sgDayRangeUtcMs(todayIso);

    const todayNoon = todayRange
      ? new Date(todayRange.startUtcMs + 12 * 60 * 60 * 1000)
      : new Date();

    const dow = new Intl.DateTimeFormat("en-US", { timeZone: SG_TZ, weekday: "short" }).format(todayNoon);
    const mapDow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const back = mapDow[dow] ?? 0;

    const todaySgStartUtc = todayRange ? todayRange.startUtcMs : todayNoon.getTime();
    const weekStartUtcMs = todaySgStartUtc - back * 24 * 60 * 60 * 1000;

    // 7 days ISO keys
    const daysIso = [];
    for (let i = 0; i < 7; i += 1) {
      const noon = new Date(weekStartUtcMs + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
      daysIso.push(isoDateInSg(noon));
    }

    const map = new Map();
    for (const iso of daysIso) {
      const rr = sgDayRangeUtcMs(iso);
      const nd = rr ? new Date(rr.startUtcMs + 12 * 60 * 60 * 1000) : new Date();
      const w = new Intl.DateTimeFormat("en-US", { timeZone: SG_TZ, weekday: "short" }).format(nd);

      map.set(iso, {
        key: iso,
        onTime: 0,
        late: 0,
        total: 0,
        otMins: 0,
        workedMins: 0,
        isOff: !isWorkdayIso(iso),
        isHoliday: isHolidayIso(iso),
        isSunday: w === "Sun",
      });
    }

    for (const r0 of rowsInRange) {
      const inD = parseApiDate(r0.checkInAt);
      if (!inD) continue;

      const iso = isoDateInSg(inD);
      const bucket = map.get(iso);
      if (!bucket) continue;

      bucket.total += 1;

      if (!bucket.isOff) {
        if (isLate(r0.checkInAt)) bucket.late += 1;
        else bucket.onTime += 1;
      }

      if (r0.checkOutAt) {
        bucket.workedMins += Math.max(0, getWorkedMinutesFromRow(r0) || 0);
        bucket.otMins += getOtMinutesFromRow(r0, !bucket.isOff);
      }
    }

    const items = Array.from(map.values());
    const maxOt = Math.max(1, ...items.map((x) => x.otMins));
    return { items, maxOt };
  }, [rowsInRange, isHolidayIso, isWorkdayIso, now]);

  // ✅ Search list works on rowsInRange
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rowsInRange.filter((r) => {
      if (onlyOpen && r.checkOutAt) return false;
      if (!s) return true;

      const note = (r.note || "").toLowerCase();
      const id = String(r.id || "").toLowerCase();
      const inText = fmtDateTime(r.checkInAt).toLowerCase();
      const outText = fmtDateTime(r.checkOutAt).toLowerCase();
      const iso = (parseApiDate(r?.checkInAt) ? isoDateInSg(parseApiDate(r.checkInAt)) : "").toLowerCase();

      return note.includes(s) || id.includes(s) || inText.includes(s) || outText.includes(s) || iso.includes(s);
    });
  }, [rowsInRange, q, onlyOpen]);

  const showList = q.trim().length > 0 || onlyOpen;

  // ✅ Quick range buttons
  const setThisWeek = useCallback(() => {
    const r = weekRangeIso(new Date());
    setFromIso(r.fromIso);
    setToIso(r.toIso);
  }, []);

  const setThisMonth = useCallback(() => {
    const r = monthRangeIso(new Date());
    setFromIso(r.fromIso);
    setToIso(r.toIso);
  }, []);

  const setLastMonth = useCallback(() => {
    const r = prevMonthRangeIso(new Date());
    setFromIso(r.fromIso);
    setToIso(r.toIso);
  }, []);

  const resetRange = useCallback(() => {
    const r = monthRangeIso(new Date());
    setFromIso(r.fromIso);
    setToIso(r.toIso);
  }, []);

  return (
    <div className="we-h-root">
      {/* background */}
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
              {stats.sessions} sessions • {stats.open} open • Range: {rangeText}
            </div>
          </div>

          <button className="we-h-refresh" onClick={refresh} disabled={busy}>
            {busy ? (
              <span className="we-h-spin">
                <span className="we-h-spinner" />
                Loading…
              </span>
            ) : (
              <>⟳ Refresh</>
            )}
          </button>
        </div>

        {err ? <div className="we-h-error">{err}</div> : null}

        {/* Date Range */}
        <div className="we-h-glass">
          <div className="we-h-cardHead">
            <div>
              <div className="we-h-cardTitle">Date Range</div>
              <div className="we-h-cardHint">Default is this week. Select to review.</div>
            </div>
            <div className="we-h-cardMeta">{rangeText}</div>
          </div>

          <div className="we-h-rangeGrid">
            <div className="we-h-rangeField">
              <label>From</label>
              <div className="we-h-dateWrap">
                <input className="we-h-dateInput" type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} />
              </div>
            </div>

            <div className="we-h-rangeField">
              <label>To</label>
              <div className="we-h-dateWrap">
                <input className="we-h-dateInput" type="date" value={toIso} onChange={(e) => setToIso(e.target.value)} />
              </div>
            </div>

            <div className="we-h-rangeBtns">
              <button className="we-h-chip" onClick={setThisWeek} type="button">
                This Week
              </button>
              <button className="we-h-chip" onClick={setThisMonth} type="button">
                This Month
              </button>
              <button className="we-h-chip" onClick={setLastMonth} type="button">
                Last Month
              </button>
              <button className="we-h-chip ghost" onClick={resetRange} type="button">
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="we-h-glass">
          <div className="we-h-cardHead">
            <div>
              <div className="we-h-cardTitle">Overview</div>
              <div className="we-h-cardHint">
                Workdays: Mon–Sat • Sunday + Public Holiday = OFF • On-time: before 08:15 • OT: from backend minutes
              </div>
            </div>
            <div className="we-h-cardMeta">{stats.sessions} sessions</div>
          </div>

          <div className="we-h-overview">
            <div className="we-h-donutGrid">
              <div className="we-h-donutCard">
                <div className="we-h-donutCardTitle">On-time quality</div>
                <div className="we-h-donut">
                  <div
                    className="we-h-donutRing"
                    style={{ "--pct": `${overviewDonuts.onTimePct}%` }}
                  >
                    <div className="we-h-donutCenter">
                      <div className="we-h-donutPct">{overviewDonuts.onTimePct}%</div>
                      <div className="we-h-donutLbl">On time</div>
                      <div className="we-h-donutSub">Late {overviewDonuts.latePct}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="we-h-donutCard">
                <div className="we-h-donutCardTitle">Coverage</div>
                <div className="we-h-donut">
                  <div
                    className="we-h-donutRing blue"
                    style={{ "--pct": `${overviewDonuts.coveragePct}%` }}
                  >
                    <div className="we-h-donutCenter">
                      <div className="we-h-donutPct">{overviewDonuts.coveragePct}%</div>
                      <div className="we-h-donutLbl">Worked days</div>
                      <div className="we-h-donutSub">Absent {stats.absent}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="we-h-donutCard">
                <div className="we-h-donutCardTitle">Mon-Sat OT</div>
                <div className="we-h-donut">
                  <div
                    className="we-h-donutRing amber"
                    style={{ "--pct": `${overviewDonuts.otWorkPct}%` }}
                  >
                    <div className="we-h-donutCenter">
                      <div className="we-h-donutPct">{overviewDonuts.otWorkPct}%</div>
                      <div className="we-h-donutLbl">Mon-Sat OT</div>
                      <div className="we-h-donutSub">{formatHm(stats.overtimeWorkMinutes)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="we-h-donutCard">
                <div className="we-h-donutCardTitle">Sun/PH OT</div>
                <div className="we-h-donut">
                  <div
                    className="we-h-donutRing slate"
                    style={{ "--pct": `${overviewDonuts.otOffPct}%` }}
                  >
                    <div className="we-h-donutCenter">
                      <div className="we-h-donutPct">{overviewDonuts.otOffPct}%</div>
                      <div className="we-h-donutLbl">Sun/PH OT</div>
                      <div className="we-h-donutSub">{formatHm(stats.overtimeOffMinutes)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="we-h-kpiGrid">
              <div className="we-h-kpiCard">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">Working days</div>
                  <div className="we-h-kpiValue">{stats.workingDays}</div>
                </div>
                <div className="we-h-kpiSub">
                  Expected: {stats.expectedWorkdays} • Absent: {stats.absent}
                </div>
              </div>

              <div className="we-h-kpiCard">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">Sessions</div>
                  <div className="we-h-kpiValue">{stats.sessions}</div>
                </div>
                <div className="we-h-kpiSub">Total clock in/out records</div>
              </div>

              <div className="we-h-kpiCard">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">On time</div>
                  <div className="we-h-kpiValue green">{stats.onTimeWorkdaySessions}</div>
                </div>
                <div className="we-h-kpiSub">Workday sessions on-time ({overviewDonuts.onTimePct}%)</div>
              </div>

              <div className="we-h-kpiCard">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">Late</div>
                  <div className="we-h-kpiValue purple">{stats.lateWorkdaySessions}</div>
                </div>
                <div className="we-h-kpiSub">Workday sessions late</div>
              </div>

              <div className="we-h-kpiCard">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">Overtime</div>
                  <div className="we-h-kpiValue">{formatHm(stats.overtimeMinutes)}</div>
                </div>

                <div className="we-h-kpiSub">
                  Normal OT (Mon–Sat): <b>{formatHm(stats.overtimeWorkMinutes)}</b>
                  <br />
                  Sun / PH OT: <b>{formatHm(stats.overtimeOffMinutes)}</b>
                </div>
              </div>

              <div className="we-h-kpiCard wide">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">Sunday/PH worked days</div>
                  <div className="we-h-kpiValue">{stats.offDayWorkedDays}</div>
                </div>
                <div className="we-h-kpiSub">Sessions on Sunday/public holidays: {stats.offDaySessions}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Report */}
        <div className="we-h-glass">
          <div className="we-h-cardHead">
            <div>
              <div className="we-h-cardTitle">Daily Report</div>
              <div className="we-h-cardHint">
                This week (Sun → Sat) • Donut split by 24h: work, OT, rest
              </div>
            </div>

            <div className="we-h-legend">
              <span className="dot green" /> Work
              <span className="dot ot" /> OT
              <span className="dot off" /> Rest
              <span className="dot purple" /> Late marker
            </div>
          </div>

          <div className="we-h-dailyDonutGrid">
            {daily.items.map((d) => {
              const DAY_MINS = 24 * 60;
              const totalWork = Math.max(0, d.workedMins);
              const otOnly = Math.max(0, Math.min(totalWork, d.otMins));
              const normalWork = Math.max(0, totalWork - otOnly);

              const workPct = Math.min(100, Math.round((normalWork / DAY_MINS) * 100));
              const otPct = Math.min(100 - workPct, Math.round((otOnly / DAY_MINS) * 100));
              const donutWorkEnd = workPct;
              const donutOtEnd = Math.min(100, workPct + otPct);
              const otScale = daily.maxOt > 0 ? Math.round((d.otMins / daily.maxOt) * 100) : 0;
              const hasLate = d.late > 0;

              const offText = d.isOff ? (d.isSunday ? "OFF" : d.isHoliday ? "Holiday" : "OFF") : "";

              const title = `${prettyDate(d.key)} • total ${d.total}${d.otMins ? ` • OT ${formatHm(d.otMins)}` : ""}${
                d.isOff ? ` • ${offText}` : ""
              }`;

              return (
                <div
                  className={`we-h-dayCard ${d.isOff && !totalWork ? "off" : ""} ${d.otMins > 0 ? "has-ot" : ""} ${hasLate ? "has-late" : ""}`}
                  key={d.key}
                  title={title}
                >
                  <div
                    className={`we-h-dayDonut ${d.isOff && !totalWork ? "off" : ""} ${d.otMins > 0 ? "has-ot" : ""}`}
                    style={{ "--workEnd": `${donutWorkEnd}%`, "--otEnd": `${donutOtEnd}%` }}
                  >
                    <div className="we-h-dayCenter">
                      <div className="we-h-dayCount">{formatHShort(totalWork)}</div>
                      <div className="we-h-dayUnit">worked</div>
                    </div>
                  </div>

                  <div className="we-h-dayMeta">
                    <div className="we-h-dayLabel">{weekdayShort(d.key)}</div>
                    {d.isOff ? <div className="we-h-dayOff">{offText}</div> : null}
                    {!d.isOff ? <div className="we-h-dayRate">Work {formatHm(normalWork)} • Late {d.late}</div> : null}
                    <div className={`we-h-dayOt ${d.otMins > 0 ? "active" : ""}`}>OT {d.otMins ? formatHm(d.otMins) : "-"}</div>
                    <div className="we-h-dayOtBar">
                      <span style={{ width: `${otScale}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="we-h-glass">
          <div className="we-h-searchHead">
            <div className="we-h-cardTitle">Search</div>
            <div className="we-h-cardMeta">Type to show results</div>
          </div>

          <div className="we-h-filterGrid">
            <div className="we-h-input">
              <span className="we-h-ic">🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by note / id / date (e.g. 2026-01-29)"
              />
            </div>

            <label className="we-h-check">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Show only open sessions
            </label>

            {!showList ? <div className="we-h-searchHint">List is hidden. Type a date / note / id to show sessions.</div> : null}
          </div>
        </div>

        {/* List */}
        <div className="we-h-glass">
          {!showList ? (
            <div className="we-h-empty">Start searching to see your sessions.</div>
          ) : filtered.length === 0 ? (
            <div className="we-h-empty">No matches found.</div>
          ) : (
            <div className="we-h-list">
              {filtered.map((r) => {
                const inD = parseApiDate(r.checkInAt);
                const dayIso = inD ? isoDateInSg(inD) : "";
                const wd = dayIso ? isWorkdayIso(dayIso) : true;

                const isOpen = !r.checkOutAt;

                const worked = getWorkedMinutesFromRow(r);
                const ot = r.checkOutAt ? getOtMinutesFromRow(r, wd) : 0;

                return (
                  <div key={r.id} className="we-h-item">
                    <div className="we-h-itemTop">
                      <div className="we-h-itemId">🧾 #{r.id}</div>
                      <span className={`we-h-pill ${isOpen ? "open" : "closed"}`}>{isOpen ? "OPEN" : "CLOSED"}</span>
                    </div>

                    <div className="we-h-ioGrid">
                      <div className="we-h-ioRow">
                        <div className="we-h-ioLbl">In</div>
                        <div className="we-h-ioVal">{fmtDateTime(r.checkInAt)}</div>
                      </div>

                      <div className="we-h-ioRow">
                        <div className="we-h-ioLbl">Out</div>
                        <div className="we-h-ioVal">{fmtDateTime(r.checkOutAt)}</div>
                      </div>

                      <div className="we-h-ioRow we-h-ioRowRight">
                        <div className="we-h-ioLbl">Worked</div>
                        <div className="we-h-ioVal strong">{worked == null ? "—" : `${worked} min`}</div>
                      </div>

                      <div className="we-h-ioRow we-h-ioRowRight">
                        <div className="we-h-ioLbl">Overtime</div>
                        <div className="we-h-ioVal strong">{ot ? formatHm(ot) : "—"}</div>
                      </div>
                    </div>

                    {r.note ? (
                      <div className="we-h-noteRow">
                        <span className="we-h-noteLbl">Note:</span>
                        <span className="we-h-noteVal">{r.note}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="we-h-footSpace" />
      </div>
    </div>
  );
}
