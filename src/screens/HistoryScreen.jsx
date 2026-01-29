import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { attendanceApi } from "../api/attendance";
import { fmtDateTime, parseApiDate } from "../utils/datetime";
import "./HistoryScreen.css";

/** Rules */
const ON_TIME_HOUR = 8;
const ON_TIME_MINUTE = 15;

const SHIFT_END_HOUR = 17; // after 17:00 => overtime
// Workdays: Mon–Sat. Sunday OFF. Public holiday OFF.

function pad2(n) {
  return String(n).padStart(2, "0");
}
function localIsoDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function startOfWeekSunday(d) {
  const sd = startOfDay(d);
  const dow = sd.getDay(); // 0=Sun
  sd.setDate(sd.getDate() - dow);
  return sd;
}
function minutesBetween(a, b) {
  const da = parseApiDate(a);
  const db = parseApiDate(b);
  if (!da || !db) return null;
  const mins = Math.round((db.getTime() - da.getTime()) / 60000);
  return mins >= 0 ? mins : null;
}
function isLate(checkInAt) {
  const d = parseApiDate(checkInAt);
  if (!d) return false;
  const h = d.getHours();
  const m = d.getMinutes();
  return h > ON_TIME_HOUR || (h === ON_TIME_HOUR && m > ON_TIME_MINUTE);
}
function overtimeMinutes(checkInAt, checkOutAt) {
  const inD = parseApiDate(checkInAt);
  const outD = parseApiDate(checkOutAt);
  if (!inD || !outD) return 0;

  // OT starts at 17:00 of check-in date
  const cutoff = new Date(inD.getFullYear(), inD.getMonth(), inD.getDate(), SHIFT_END_HOUR, 0, 0, 0);
  const extra = Math.max(0, outD.getTime() - cutoff.getTime());
  return Math.round(extra / 60000);
}
function formatHm(mins) {
  const m = Math.max(0, mins || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}
function prettyDate(dayKey) {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  const w = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
  const md = new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(d);
  const y = new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(d);
  return `${w} · ${md}, ${y}`;
}
function weekdayShort(dayKey) {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}
function daysBetweenInclusive(a, b) {
  const out = [];
  const cur = new Date(a.getTime());
  while (cur.getTime() <= b.getTime()) {
    out.push(new Date(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
function dayKeyFromRow(r) {
  const d = parseApiDate(r?.checkInAt) || parseApiDate(r?.createdAt) || parseApiDate(r?.timestamp);
  return d ? localIsoDate(d) : "";
}

export function HistoryScreen({ onAuthError }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  // Map<year, Set<YYYY-MM-DD>>
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
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }, [onAuthError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Determine min/max date from rows
  const range = useMemo(() => {
    let min = null;
    let max = null;
    for (const r of rows) {
      const d = parseApiDate(r?.checkInAt);
      if (!d) continue;
      const sd = startOfDay(d);
      if (!min || sd.getTime() < min.getTime()) min = sd;
      if (!max || sd.getTime() > max.getTime()) max = sd;
    }
    return { min, max };
  }, [rows]);

  // Load holidays for all years seen in range (and current year fallback)
  useEffect(() => {
    let cancelled = false;

    const years = new Set();
    years.add(new Date().getFullYear());
    if (range.min && range.max) {
      for (let y = range.min.getFullYear(); y <= range.max.getFullYear(); y += 1) years.add(y);
    }

    async function fetchYear(y) {
      try {
        const list = await attendanceApi.holidays(y);
        const set = new Set(
          (Array.isArray(list) ? list : [])
            .map((h) => String(h?.date ?? h?.Date ?? "").slice(0, 10))
            .filter(Boolean)
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
  }, [range.min, range.max]);

  const isHoliday = useCallback(
    (d) => {
      const set = holidaySets.get(d.getFullYear());
      if (!set) return false;
      return set.has(localIsoDate(d));
    },
    [holidaySets]
  );

  const isWorkday = useCallback(
    (d) => {
      if (d.getDay() === 0) return false; // Sunday
      if (isHoliday(d)) return false; // public holiday
      return true; // Mon–Sat
    },
    [isHoliday]
  );

  const stats = useMemo(() => {
    const sessions = rows.length;
    const open = rows.filter((r) => !r.checkOutAt).length;

    const attendedWorkdayKeys = new Set();
    let onTimeWorkdaySessions = 0;
    let lateWorkdaySessions = 0;
    let offDaySessions = 0;
    let overtime = 0;

    const min = range.min;
    const max = range.max;

    for (const r of rows) {
      const inD = parseApiDate(r.checkInAt);
      if (!inD) continue;

      const dk = localIsoDate(inD);

      if (isWorkday(inD)) {
        attendedWorkdayKeys.add(dk);
        if (isLate(r.checkInAt)) lateWorkdaySessions += 1;
        else onTimeWorkdaySessions += 1;
      } else {
        offDaySessions += 1;
      }

      if (r.checkOutAt) overtime += overtimeMinutes(r.checkInAt, r.checkOutAt);
    }

    let expectedWorkdays = 0;
    if (min && max) expectedWorkdays = daysBetweenInclusive(min, max).filter(isWorkday).length;

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
      overtimeMinutes: overtime,
      offDaySessions,
      rangeText:
        min && max ? `${prettyDate(localIsoDate(min))} → ${prettyDate(localIsoDate(max))}` : "—",
    };
  }, [rows, range.min, range.max, isWorkday]);

  /**
   * ✅ Daily report = CURRENT WEEK (Sunday → Saturday)
   * anchored by last attendance date (or today).
   * Includes overtime total per day (small cap, tooltip).
   */
  const daily = useMemo(() => {
    const anchor = range.max ? startOfDay(range.max) : startOfDay(new Date());
    const weekStart = startOfWeekSunday(anchor); // ✅ Sunday first

    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStart.getTime());
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    const map = new Map();
    for (const d of days) {
      const k = localIsoDate(d);
      map.set(k, {
        key: k,
        onTime: 0,
        late: 0,
        total: 0,
        otMins: 0,
        isOff: !isWorkday(d),
        isHoliday: isHoliday(d),
        isSunday: d.getDay() === 0,
      });
    }

    for (const r of rows) {
      const inD = parseApiDate(r.checkInAt);
      if (!inD) continue;

      const k = localIsoDate(inD);
      const bucket = map.get(k);
      if (!bucket) continue;

      bucket.total += 1;

      if (!bucket.isOff) {
        if (isLate(r.checkInAt)) bucket.late += 1;
        else bucket.onTime += 1;
      }

      if (r.checkOutAt) {
        bucket.otMins += overtimeMinutes(r.checkInAt, r.checkOutAt);
      }
    }

    const items = Array.from(map.values());
    const maxTotal = Math.max(1, ...items.map((x) => x.total));
    const maxOt = Math.max(1, ...items.map((x) => x.otMins));
    return { items, maxTotal, maxOt };
  }, [rows, range.max, isHoliday, isWorkday]);

  // Search-first list (hidden by default)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s && !onlyOpen) return [];

    return rows.filter((r) => {
      if (onlyOpen && r.checkOutAt) return false;
      if (!s) return true;

      const note = (r.note || "").toLowerCase();
      const id = String(r.id || "").toLowerCase();
      const inText = fmtDateTime(r.checkInAt).toLowerCase();
      const outText = fmtDateTime(r.checkOutAt).toLowerCase();
      const iso = dayKeyFromRow(r).toLowerCase();

      return note.includes(s) || id.includes(s) || inText.includes(s) || outText.includes(s) || iso.includes(s);
    });
  }, [rows, q, onlyOpen]);

  const showList = q.trim().length > 0 || onlyOpen;

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
              {stats.sessions} sessions • {stats.open} open • Range: {stats.rangeText}
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

        {/* Overview */}
        <div className="we-h-glass">
          <div className="we-h-cardHead">
            <div>
              <div className="we-h-cardTitle">Overview</div>
              <div className="we-h-cardHint">
                Workdays: Mon–Sat • Sunday + Public Holiday = OFF • On-time: before 08:15 • OT: after 17:00
              </div>
            </div>
            <div className="we-h-cardMeta">{stats.sessions} sessions</div>
          </div>

          <div className="we-h-overview">
            <div className="we-h-donut">
              <div className="we-h-donutRing" style={{ "--pct": `${stats.onTimePct}%` }}>
                <div className="we-h-donutCenter">
                  <div className="we-h-donutPct">{stats.onTimePct}%</div>
                  <div className="we-h-donutLbl">On time</div>
                  <div className="we-h-donutSub">Workdays only</div>
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
                <div className="we-h-kpiSub">Workday sessions on-time</div>
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
                <div className="we-h-kpiSub">After 17:00 checkout</div>
              </div>

              <div className="we-h-kpiCard wide">
                <div className="we-h-kpiTop">
                  <div className="we-h-kpiLabel">OFF-day sessions</div>
                  <div className="we-h-kpiValue">{stats.offDaySessions}</div>
                </div>
                <div className="we-h-kpiSub">Sessions on Sunday / public holidays</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Report (Sun → Sat, compact + OT cap) */}
        <div className="we-h-glass">
          <div className="we-h-cardHead">
            <div>
              <div className="we-h-cardTitle">Daily Report</div>
              <div className="we-h-cardHint">
                This week (Sun → Sat) • Height = sessions/day • Purple = late (workdays) • Orange cap = overtime
              </div>
            </div>

            <div className="we-h-legend">
              <span className="dot green" /> On time
              <span className="dot purple" /> Late
              <span className="dot ot" /> OT
              <span className="dot off" /> OFF day
            </div>
          </div>

          <div className="we-h-bars">
            {daily.items.map((d) => {
              // compact height
              const MAX_BAR_PX = 96;
              const MIN_BAR_PX = 10;
              const BASE_PX = 8;

              const barPx =
                d.total === 0 ? MIN_BAR_PX : Math.round((d.total / daily.maxTotal) * MAX_BAR_PX) + BASE_PX;

              // stacked inside bar
              const onPct = d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0;
              const latePct = d.total > 0 ? Math.round((d.late / d.total) * 100) : 0;

              // OT cap height (fixed small cap, scaled)
              const CAP_MAX_PX = 10;
              const capPx = d.otMins > 0 ? Math.max(2, Math.round((d.otMins / daily.maxOt) * CAP_MAX_PX)) : 0;

              const offText = d.isOff
                ? d.isSunday
                  ? "OFF"
                  : d.isHoliday
                  ? "Holiday"
                  : "OFF"
                : "";

              const title = `${prettyDate(d.key)} • total ${d.total}${
                d.otMins ? ` • OT ${formatHm(d.otMins)}` : ""
              }${d.isOff ? ` • ${offText}` : ""}`;

              return (
                <div className="we-h-barCol" key={d.key} title={title}>
                  <div className={`we-h-barWrap ${d.isOff ? "off" : ""}`} style={{ height: `${barPx}px` }}>
                    {d.total === 0 ? (
                      <div className="we-h-barEmpty" />
                    ) : d.isOff ? (
                      <div className="we-h-barOff" />
                    ) : (
                      <>
                        {/* OT cap (small) */}
                        {capPx > 0 ? <div className="we-h-barOTCap" style={{ height: `${capPx}px` }} /> : null}

                        {/* late then on-time */}
                        <div className="we-h-barLate" style={{ height: `${latePct}%` }} />
                        <div className="we-h-barOn" style={{ height: `${onPct}%` }} />
                      </>
                    )}
                  </div>

                  <div className="we-h-barLbl">{weekdayShort(d.key)}</div>
                  <div className="we-h-barNum">{d.total}</div>
                  {d.isOff ? <div className="we-h-barOffTxt">{offText}</div> : null}
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

            {!showList ? (
              <div className="we-h-searchHint">List is hidden. Type a date / note / id to show sessions.</div>
            ) : null}
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
                const mins = minutesBetween(r.checkInAt, r.checkOutAt);
                const isOpen = !r.checkOutAt;
                const ot = r.checkOutAt ? overtimeMinutes(r.checkInAt, r.checkOutAt) : 0;

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
                        <div className="we-h-ioLbl">Duration</div>
                        <div className="we-h-ioVal strong">{mins === null ? "—" : `${mins} min`}</div>
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