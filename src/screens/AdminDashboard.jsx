import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listEmployees } from "../api/employees";
import { apiFetch } from "../api/client";
import { fmtDateTime } from "../utils/datetime";
import { formatDurationMinutes, pickReportOtMinutes } from "../utils/attendanceFormat";

import { SUMMARY_ENDPOINT } from "./adminDashboard/constants";
import { toIsoRangeParams } from "./adminDashboard/timezone";

import AttendanceReport from "./adminDashboard/AttendanceReport";
import RecentActivity from "./adminDashboard/RecentActivity";
import EmployeeInOutMatrix from "./adminDashboard/EmployeeInOutMatrix";
import EditAttendanceModal from "./adminDashboard/EditAttendanceModal";

// ✅ split CSS files (no more styles.js)
import "./adminDashboard/styles/base.css";
import "./adminDashboard/styles/matrix.css";
import "./adminDashboard/styles/report.css";
import "./adminDashboard/styles/recentActivity.css";
import "./adminDashboard/styles/modal.css";
import { useTheme } from "../theme/context";

/** YYYY-MM-DD in Singapore time */
const SG_TZ = "Asia/Singapore";

function parseIsoDateInput(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function daysBetweenInclusiveIso(fromIso, toIso) {
  const out = [];
  const a = parseIsoDateInput(fromIso);
  const b = parseIsoDateInput(toIso);
  if (!a || !b) return out;

  let cur = new Date(Date.UTC(a.y, a.m - 1, a.d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(b.y, b.m - 1, b.d, 0, 0, 0, 0));
  while (cur.getTime() <= end.getTime()) {
    out.push(`${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function sgWeekRangeIso(baseDate) {
  const baseIso = localIsoDate(baseDate);
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

function monthRangeIso(baseDate) {
  const baseIso = localIsoDate(baseDate);
  const a = parseIsoDateInput(baseIso);
  if (!a) return { fromIso: "", toIso: "" };
  const y = a.y;
  const m = a.m;
  const fromIso = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0));
  const toIso = `${y}-${pad2(m)}-${pad2(lastDay.getUTCDate())}`;
  return { fromIso, toIso };
}

function prevMonthRangeIso(baseDate) {
  const baseIso = localIsoDate(baseDate);
  const a = parseIsoDateInput(baseIso);
  if (!a) return { fromIso: "", toIso: "" };
  let y = a.y;
  let m = a.m - 1;
  if (m <= 0) { m = 12; y -= 1; }
  const fromIso = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0));
  const toIso = `${y}-${pad2(m)}-${pad2(lastDay.getUTCDate())}`;
  return { fromIso, toIso };
}
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

function toDateKey(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return localIsoDate(d);
}

function isLate(checkInAt) {
  if (!checkInAt) return false;
  const d = new Date(checkInAt);
  if (Number.isNaN(d.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SG_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh > 8 || (hh === 8 && mm > 15);
}

function isWorkdayIso(iso, holidaySet) {
  if (!iso) return false;
  if (holidaySet?.has?.(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: SG_TZ, weekday: "short" }).format(d);
  return dow !== "Sun";
}

const formatHm = formatDurationMinutes;

function finiteNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function AdminDashboard({ onAuthError }) {
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [overnightPending, setOvernightPending] = useState([]);
  const [overnightBusy, setOvernightBusy] = useState(false);
  const [preApprovals, setPreApprovals] = useState([]);
  const [preApproveEmployeeId, setPreApproveEmployeeId] = useState("");
  const [preApproveDate, setPreApproveDate] = useState(() => sgWeekRangeIso(new Date()).fromIso);
  const [preApproveNote, setPreApproveNote] = useState("");
  const [preApproveBusy, setPreApproveBusy] = useState(false);
  const [viewMode, setViewMode] = useState("overview");
  const { theme } = useTheme();

  const mountedRef = useRef(true);

  const setThisWeek = () => {
    const r = sgWeekRangeIso(new Date());
    setFrom(r.fromIso);
    setTo(r.toIso);
  };
  const setThisMonth = () => {
    const r = monthRangeIso(new Date());
    setFrom(r.fromIso);
    setTo(r.toIso);
  };
  const setLastMonth = () => {
    const r = prevMonthRangeIso(new Date());
    setFrom(r.fromIso);
    setTo(r.toIso);
  };


  const [from, setFrom] = useState(() => sgWeekRangeIso(new Date()).fromIso);
  const [to, setTo] = useState(() => sgWeekRangeIso(new Date()).toIso);
  const fromRef = useRef(from);
  const toRef = useRef(to);

  useEffect(() => {
    fromRef.current = from;
    toRef.current = to;
  }, [from, to]);

  const load = useCallback(async (range = null) => {
    setErr("");
    setBusy(true);
    try {
      const rawFrom = range?.from ?? fromRef.current;
      const rawTo = range?.to ?? toRef.current;
      const f = rawFrom && rawTo && rawFrom > rawTo ? rawTo : rawFrom;
      const t = rawFrom && rawTo && rawFrom > rawTo ? rawFrom : rawTo;

      const qs = toIsoRangeParams(f, t);
      const [emps, sum, pending, pre] = await Promise.all([
        listEmployees(true),
        apiFetch(`${SUMMARY_ENDPOINT}?${qs.toString()}`, {
          method: "GET",
          auth: true,
        }),
        apiFetch("/api/Attendance/overnight/pending", { method: "GET", auth: true }),
        apiFetch(`/api/Attendance/overnight/preapprove?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`, { method: "GET", auth: true }),
      ]);

      if (!mountedRef.current) return;
      setEmployees(Array.isArray(emps) ? emps : []);
      setSummary(sum || null);
      setOvernightPending(Array.isArray(pending) ? pending : []);
      setPreApprovals(Array.isArray(pre) ? pre : []);
    } catch (e) {
      const msg = e?.message || "Failed to load dashboard";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      if (mountedRef.current) setErr(msg);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [onAuthError]);

  async function handleCreatePreApproval() {
    const empId = Number(preApproveEmployeeId);
    const date = preApproveDate;
    if (!empId || !date) {
      setErr("Please select employee and date.");
      return;
    }

    setPreApproveBusy(true);
    try {
      await apiFetch("/api/Attendance/overnight/preapprove", {
        method: "POST",
        auth: true,
        body: { employeeId: empId, date, note: preApproveNote || null },
      });
      if (!mountedRef.current) return;
      setPreApproveNote("");
      await load({ from, to });
    } catch (e) {
      const msg = e?.message || "Failed to create pre-approval";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      if (mountedRef.current) setErr(msg);
    } finally {
      if (mountedRef.current) setPreApproveBusy(false);
    }
  }

  async function handleDeletePreApproval(id) {
    setPreApproveBusy(true);
    try {
      await apiFetch(`/api/Attendance/overnight/preapprove/${encodeURIComponent(id)}`, {
        method: "DELETE",
        auth: true,
      });
      await load({ from, to });
    } catch (e) {
      const msg = e?.message || "Failed to remove pre-approval";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      if (mountedRef.current) setErr(msg);
    } finally {
      if (mountedRef.current) setPreApproveBusy(false);
    }
  }

  async function handleOvernightDecision(logId, approve) {
    setOvernightBusy(true);
    try {
      await apiFetch(`/api/Attendance/log/${encodeURIComponent(logId)}/approve-overnight`, {
        method: "POST",
        auth: true,
        body: { approve },
      });
      await load({ from, to });
    } catch (e) {
      const msg = e?.message || "Failed to update overnight approval";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      if (mountedRef.current) setErr(msg);
    } finally {
      if (mountedRef.current) setOvernightBusy(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    load({ from: fromRef.current, to: toRef.current });
    return () => {
      mountedRef.current = false;
    };
  }, [load]);


  const recentActivity = useMemo(() => summary?.recentActivity ?? [], [summary]);

  const employeeMap = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(Number(e.id), e);
    return m;
  }, [employees]);

  const allDepartments = useMemo(() => {
    const set = new Set();
    for (const e of employees)
      if (e?.department) set.add(String(e.department).trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const holidayIsoSet = useMemo(() => {
    const out = new Set();
    for (const h of summary?.holidays || []) {
      const iso = String(h?.date ?? h?.Date ?? "").slice(0, 10);
      if (iso) out.add(iso);
    }
    return out;
  }, [summary]);


  const employeeInsights = useMemo(() => {
    const rows = Array.isArray(recentActivity) ? recentActivity : [];
    const statsRows = Array.isArray(summary?.employeeStats) ? summary.employeeStats : [];
    const statsByEmp = new Map(
      statsRows
        .map((s) => [Number(s?.employeeId), s])
        .filter(([id]) => Number.isFinite(id))
    );

    const f = from || localIsoDate(new Date());
    const t = to || f;
    const start = f <= t ? f : t;
    const end = f <= t ? t : f;

    const days = daysBetweenInclusiveIso(start, end);
    const totalDays = Math.max(1, days.length);
    const holidays = new Set(
      (summary?.holidays || [])
        .map((h) => String(h?.date ?? h?.Date ?? "").slice(0, 10))
        .filter(Boolean)
    );
    const workdaySet = new Set(days.filter((d) => isWorkdayIso(d, holidays)));
    const expectedWorkdays = Math.max(1, workdaySet.size);

    const presentDaysByEmp = new Map();
    const lateDaysByEmp = new Map();
    const totalWorkedByEmp = new Map();
    const otByEmp = new Map();
    const normalOtByEmp = new Map();
    const sunPhOtByEmp = new Map();
    const overnightOtByEmp = new Map();

    // Fallback values from recent activity (only used when summary.employeeStats lacks fields)
    for (const r of rows) {
      const empId = Number(r?.employeeId ?? r?.empId ?? r?.staffId ?? r?.userId ?? NaN);
      if (!Number.isFinite(empId)) continue;

      const inAt = r?.checkInAt ?? r?.inAt ?? r?.clockInAt ?? r?.startAt ?? r?.timeIn ?? null;
      const outAt = r?.checkOutAt ?? r?.outAt ?? r?.clockOutAt ?? r?.endAt ?? r?.timeOut ?? null;
      const dayKey = toDateKey(r?.date ?? r?.day ?? r?.workDate ?? inAt ?? outAt);
      if (!dayKey || dayKey < start || dayKey > end) continue;

      if (inAt) {
        if (!presentDaysByEmp.has(empId)) presentDaysByEmp.set(empId, new Set());
        presentDaysByEmp.get(empId).add(dayKey);
      }

      if (inAt && workdaySet.has(dayKey) && isLate(inAt)) {
        if (!lateDaysByEmp.has(empId)) lateDaysByEmp.set(empId, new Set());
        lateDaysByEmp.get(empId).add(dayKey);
      }

      const regMins = finiteNumberOrNull(r?.regularMinutes);
      const safeOtMins = pickReportOtMinutes(r);
      const totalMins = Math.max(0, Math.round((regMins ?? 0) + safeOtMins));
      totalWorkedByEmp.set(empId, (totalWorkedByEmp.get(empId) || 0) + totalMins);
      otByEmp.set(empId, (otByEmp.get(empId) || 0) + safeOtMins);

      if (safeOtMins > 0) {
        const offDay = !workdaySet.has(dayKey);
        const outDayKey = toDateKey(outAt);
        const overnight = !!(outDayKey && outDayKey !== dayKey);
        if (offDay) sunPhOtByEmp.set(empId, (sunPhOtByEmp.get(empId) || 0) + safeOtMins);
        else normalOtByEmp.set(empId, (normalOtByEmp.get(empId) || 0) + safeOtMins);
        if (overnight) overnightOtByEmp.set(empId, (overnightOtByEmp.get(empId) || 0) + safeOtMins);
      }
    }

    const palette = ["#22c55e", "#38bdf8", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];
    const orderedEmployees = [...employees].sort((a, b) => {
      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      const byName = an.localeCompare(bn);
      if (byName !== 0) return byName;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });

    return orderedEmployees.map((e, idx) => {
      const empId = Number(e.id);
      const stat = statsByEmp.get(empId) || null;

      const fallbackPresentDays = presentDaysByEmp.get(empId)?.size || 0;
      const fallbackWorkdaysWorked = Array.from(presentDaysByEmp.get(empId) || []).filter((d) => workdaySet.has(d)).length;
      const fallbackLateDays = lateDaysByEmp.get(empId)?.size || 0;

      const presentDays = finiteNumberOrNull(stat?.daysWorked) ?? fallbackPresentDays;
      const workedWorkdays = finiteNumberOrNull(stat?.workdaysWorked) ?? fallbackWorkdaysWorked;
      const lateDays = finiteNumberOrNull(stat?.lateDays) ?? fallbackLateDays;
      const totalWorkedMinutes = finiteNumberOrNull(stat?.totalWorkedMinutes) ?? (totalWorkedByEmp.get(empId) || 0);
      const employeeOtMinutes = finiteNumberOrNull(stat?.overtimeMinutes) ?? (otByEmp.get(empId) || 0);
      const normalOtMinutes = finiteNumberOrNull(stat?.normalOtMinutes) ?? (normalOtByEmp.get(empId) || 0);
      const sunPhOtMinutes = finiteNumberOrNull(stat?.sundayPhOtMinutes ?? stat?.sunPhOtMinutes) ?? (sunPhOtByEmp.get(empId) || 0);
      const overnightOtMinutes = finiteNumberOrNull(stat?.overnightOtMinutes) ?? (overnightOtByEmp.get(empId) || 0);
      const absentDays = Math.max(0, expectedWorkdays - workedWorkdays);

      return {
        id: e.id,
        name: e.name || `Employee #${e.id}`,
        presentDays,
        workedWorkdays,
        lateDays,
        absentDays,
        totalWorkedMinutes,
        employeeOtMinutes,
        normalOtMinutes,
        sunPhOtMinutes,
        overnightOtMinutes,
        totalDays,
        expectedWorkdays,
        color: palette[idx % palette.length],
      };
    });
  }, [employees, recentActivity, from, to, summary]);

  const insightBreakdown = useMemo(() => {
    const totalDays = Math.max(1, Number(employeeInsights?.[0]?.totalDays || 0) || 1);
    const expectedWorkdays = Math.max(1, Number(employeeInsights?.[0]?.expectedWorkdays || 0) || totalDays);
    const empCount = Math.max(1, employeeInsights.length || employees.length || 1);
    const attendanceDenom = Math.max(1, empCount * totalDays);
    const absenceDenom = Math.max(1, empCount * expectedWorkdays);

    const totalWorked = employeeInsights.reduce((a, x) => a + (x.totalWorkedMinutes || 0), 0);
    const totalOt = employeeInsights.reduce((a, x) => a + (x.employeeOtMinutes || 0), 0);
    const otPctById = new Map();

    const attendanceSegments = employeeInsights.map((x) => ({
      color: x.color,
      value: (x.presentDays / attendanceDenom) * 100,
    }));
    const otTimeSegments = employeeInsights.map((x) => {
      const share = totalOt > 0 ? (x.employeeOtMinutes / totalOt) * 100 : 0;
      return { color: x.color, value: share };
    });
    const absentSegments = employeeInsights.map((x) => ({
      color: x.color,
      value: (x.absentDays / absenceDenom) * 100,
    }));
    const otSegments = employeeInsights.map((x) => {
      const value = totalWorked > 0 ? (x.employeeOtMinutes / totalWorked) * 100 : 0;
      const otShare = totalOt > 0 ? Math.round((x.employeeOtMinutes / totalOt) * 100) : 0;
      otPctById.set(x.id, otShare);
      return { color: x.color, value };
    });

    const attendanceRate = Math.max(0, Math.min(100, Math.round(attendanceSegments.reduce((a, x) => a + x.value, 0))));
    const otTimeRate = Math.max(0, Math.min(100, Math.round(otTimeSegments.reduce((a, x) => a + x.value, 0))));
    const absentRate = Math.max(0, Math.min(100, Math.round(absentSegments.reduce((a, x) => a + x.value, 0))));
    const overtimeRate = totalWorked > 0 ? Math.max(0, Math.min(100, Math.round((totalOt / totalWorked) * 100))) : 0;

    const buildRing = (segments, fallbackColor = "#22c55e") => {
      const valid = segments.filter((x) => x.value > 0.02);
      if (valid.length === 0) return "conic-gradient(rgba(226,232,240,.14) 0 100%)";
      const total = valid.reduce((a, x) => a + x.value, 0);
      let cursor = 0;
      const parts = [];
      for (const s of valid) {
        const pct = (s.value / total) * Math.min(100, total);
        const fromPct = cursor;
        cursor += pct;
        parts.push(`${s.color || fallbackColor} ${fromPct.toFixed(2)}% ${cursor.toFixed(2)}%`);
      }
      parts.push(`rgba(226,232,240,.14) ${cursor.toFixed(2)}% 100%`);
      return `conic-gradient(${parts.join(", ")})`;
    };

    return {
      attendanceRate,
      otTimeRate,
      absentRate,
      overtimeRate,
      attendanceRing: buildRing(attendanceSegments, "#22c55e"),
      otTimeRing: buildRing(otTimeSegments, "#f59e0b"),
      absentRing: buildRing(absentSegments, "#ef4444"),
      overtimeRing: buildRing(otSegments, "#f97316"),
      otPctById,
      totalOtMinutes: totalOt,
    };
  }, [employeeInsights, employees.length]);

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  function openEdit(row) {
    setEditRow(row);
    setEditOpen(true);
  }
  function closeEdit() {
    setEditOpen(false);
    setEditRow(null);
  }

  return (
    <div className={`we-admin-root we-theme-${theme}`}>
      <div className="we-admin-bg" aria-hidden="true">
        <div className="we-admin-blob we-admin-blob-1" />
        <div className="we-admin-blob we-admin-blob-2" />
        <div className="we-admin-blob we-admin-blob-3" />
        <div className="we-admin-noise" />
      </div>

      <div className="we-admin-wrap we-admin-layout">
        <div className="we-glass-card we-admin-hero">
          <div className="we-admin-heroTop">
            <div className="we-admin-head">
              <div>
                <div className="we-admin-kicker">Admin overview</div>
                <div className="we-admin-title">Dashboard</div>
                <div className="we-admin-sub">
                  Activities • hours • leave • sessions
                </div>
              </div>

              <button className="we-btn we-btn--refresh" onClick={() => load({ from, to })} disabled={busy}>
                {busy ? "Loading…" : "Refresh"}
              </button>
            </div>

            <div className="we-admin-heroStats">
              <div className="we-admin-heroStat">
                <span className="k">Range</span>
                <span className="v">{from} → {to}</span>
              </div>
              <div className="we-admin-heroStat">
                <span className="k">Staff</span>
                <span className="v">{employees.length}</span>
              </div>
              <div className="we-admin-heroStat">
                <span className="k">OT</span>
                <span className="v">{formatHm(insightBreakdown.totalOtMinutes)}</span>
              </div>
            </div>
          </div>

          <div className="we-admin-heroControls">
            <div className="we-admin-filterRow">
              <label className="we-admin-filterLabel">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={busy}
                />
              </label>

              <label className="we-admin-filterLabel">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={busy}
                />
              </label>

              <button
                className="we-btn-soft we-btn--apply"
                onClick={() => load({ from, to })}
                disabled={busy}
                type="button"
              >
                Apply
              </button>
            </div>

            <div className="we-admin-filterQuick">
              <button className="we-btn-chip" type="button" onClick={setThisWeek} disabled={busy}>This Week</button>
              <button className="we-btn-chip" type="button" onClick={setThisMonth} disabled={busy}>This Month</button>
              <button className="we-btn-chip ghost" type="button" onClick={setLastMonth} disabled={busy}>Last Month</button>
            </div>

            <div className="we-admin-viewSwitch" role="tablist" aria-label="Dashboard sections">
              <button
                type="button"
                className={`we-admin-viewBtn ${viewMode === "overview" ? "active" : ""}`}
                onClick={() => setViewMode("overview")}
                aria-selected={viewMode === "overview"}
              >
                Overview
              </button>
              <button
                type="button"
                className={`we-admin-viewBtn ${viewMode === "attendance" ? "active" : ""}`}
                onClick={() => setViewMode("attendance")}
                aria-selected={viewMode === "attendance"}
              >
                Attendance
              </button>
              <button
                type="button"
                className={`we-admin-viewBtn ${viewMode === "reports" ? "active" : ""}`}
                onClick={() => setViewMode("reports")}
                aria-selected={viewMode === "reports"}
              >
                Reports
              </button>
            </div>
          </div>
        </div>

        {err ? <div className="we-error">{err}</div> : null}

        {viewMode === "overview" ? (
        <section className="we-admin-block">
          <div className="we-admin-blockHead">
            <div className="we-admin-blockTitle">Overview</div>
            <div className="we-admin-sectionMeta">High-level attendance health and quick controls</div>
          </div>

          <div className="we-admin-kpiRow">
            <div className="we-admin-kpiCard">
              <div className="we-admin-kpiLabel">Attendance Rate</div>
              <div className="we-admin-kpiValue">{insightBreakdown.attendanceRate}%</div>
              <div className="we-admin-kpiHint">Present days across selected range</div>
            </div>
            <div className="we-admin-kpiCard">
              <div className="we-admin-kpiLabel">Total OT</div>
              <div className="we-admin-kpiValue">{formatHm(insightBreakdown.totalOtMinutes)}</div>
              <div className="we-admin-kpiHint">Normal + Sat + Sun/PH + Overnight</div>
            </div>
            <div className="we-admin-kpiCard">
              <div className="we-admin-kpiLabel">Absence Rate</div>
              <div className="we-admin-kpiValue">{insightBreakdown.absentRate}%</div>
              <div className="we-admin-kpiHint">Workdays only</div>
            </div>
            <div className="we-admin-kpiCard">
              <div className="we-admin-kpiLabel">Active Staff</div>
              <div className="we-admin-kpiValue">{employees.length}</div>
              <div className="we-admin-kpiHint">{from} → {to}</div>
            </div>
          </div>

          <div className="we-admin-insightRow">
            <div className="we-glass-card we-admin-charts we-admin-insightCard">
              <div className="we-admin-chartTitle">Attendance vs Absence</div>
              <div className="we-admin-donutWrap">
                <div className="we-admin-donut" style={{ background: insightBreakdown.attendanceRing }} />
                <div className="we-admin-donutCenter">
                  <div className="v">{insightBreakdown.attendanceRate}%</div>
                  <div className="k">Attendance</div>
                </div>
              </div>
              <div className="we-admin-donutNote">Clean summary view for selected date range.</div>
            </div>
            <div className="we-glass-card we-admin-charts we-admin-insightCard">
              <div className="we-admin-chartTitle">Overtime Share</div>
              <div className="we-admin-donutWrap">
                <div className="we-admin-donut warn" style={{ background: insightBreakdown.otTimeRing }} />
                <div className="we-admin-donutCenter">
                  <div className="v">{insightBreakdown.overtimeRate}%</div>
                  <div className="k">OT Ratio</div>
                </div>
              </div>
              <div className="we-admin-donutNote">OT minutes relative to worked minutes.</div>
            </div>
          </div>

          <div className="we-glass-card we-admin-preapprove">
            <div className="we-admin-sectionHead">
              <div>
                <div className="we-admin-sectionTitle">Quick Overnight Pre-approvals</div>
                <div className="we-admin-sectionMeta">Create approvals without leaving overview</div>
              </div>
            </div>

            <div className="we-preapprove-form">
              <label>Employee
                <select
                  value={preApproveEmployeeId}
                  onChange={(e) => setPreApproveEmployeeId(e.target.value)}
                  disabled={preApproveBusy}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>

              <label>Date
                <input
                  type="date"
                  value={preApproveDate}
                  onChange={(e) => setPreApproveDate(e.target.value)}
                  disabled={preApproveBusy}
                />
              </label>

              <label>Note (optional)
                <input
                  type="text"
                  value={preApproveNote}
                  onChange={(e) => setPreApproveNote(e.target.value)}
                  placeholder="Overnight site work"
                  disabled={preApproveBusy}
                />
              </label>

              <button
                type="button"
                className="we-btn we-btn--approve"
                onClick={handleCreatePreApproval}
                disabled={preApproveBusy}
              >
                Add approval
              </button>
            </div>

            <div className="we-preapprove-list">
              {preApprovals.length === 0 ? (
                <div className="we-admin-empty">No pre-approvals in this range.</div>
              ) : (
                preApprovals.map((row) => {
                  const emp = employeeMap.get(Number(row.employeeId));
                  return (
                    <div key={row.id} className="we-preapprove-item">
                      <div>
                        <div className="name">{emp?.name || `#${row.employeeId}`}</div>
                        <div className="meta">{row.date} • {row.note || "—"}</div>
                      </div>
                      <button
                        type="button"
                        className="we-btn-soft we-btn--delete"
                        onClick={() => handleDeletePreApproval(row.id)}
                        disabled={preApproveBusy}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
        ) : null}

        {viewMode === "attendance" ? (
        <section className="we-admin-block">
          <div className="we-admin-blockHead">
            <div className="we-admin-blockTitle">Attendance</div>
            <div className="we-admin-sectionMeta">Daily in/out board and recent operational timeline</div>
          </div>

          <div className="we-glass-card we-admin-attPanel">
            <EmployeeInOutMatrix
              from={from}
              to={to}
              recentActivity={recentActivity}
              employeeMap={employeeMap}
              employees={employees}
              defaultSelectedCount={3}
              onEdit={openEdit}
              embedded
            />
          </div>

          <div className="we-glass-card we-admin-attPanel">
            <RecentActivity
              recentActivity={recentActivity}
              employees={employees}
              allDepartments={allDepartments}
              employeeMap={employeeMap}
              holidaySet={holidayIsoSet}
              busy={busy}
              onEdit={openEdit}
              onlyTodayByDefault={true}
              embedded
            />
          </div>
        </section>
        ) : null}

        {viewMode === "reports" ? (
        <section className="we-admin-block">
          <div className="we-admin-blockHead">
            <div className="we-admin-blockTitle">Reports</div>
            <div className="we-admin-sectionMeta">Monthly attendance output and approval tasks</div>
          </div>

          <AttendanceReport from={from} to={to} disabled={busy} onAuthError={onAuthError} />

          <details className="we-glass-card we-admin-overnightDrawer">
            <summary>
              <span className="we-admin-sectionTitle">Overnight OT approvals</span>
              <span className="we-admin-pill warn">{overnightPending.length} pending</span>
            </summary>
            <div className="we-admin-sectionMeta">Pending overnight requests (no approval - auto-close at 17:00 next day)</div>

            {overnightPending.length === 0 ? (
              <div className="we-admin-empty">No pending overnight requests.</div>
            ) : (
              <div className="we-overnight-list">
                {overnightPending.map((row) => {
                  const emp = employeeMap.get(Number(row.employeeId));
                  const name = emp?.name || `#${row.employeeId}`;
                  return (
                    <div key={row.id} className="we-overnight-card">
                      <div className="we-overnight-head">
                        <div>
                          <div className="we-overnight-name">{name}</div>
                          <div className="we-overnight-sub">
                            In: {fmtDateTime(row.checkInAt)} • Requested out: {fmtDateTime(row.requestedCheckOutAt)}
                          </div>
                        </div>
                        <span className="we-admin-pill warn">Pending</span>
                      </div>
                      <div className="we-overnight-body">
                        <div>OT Project: <b>{row.requestedOtProjectName || "—"}</b></div>
                        {row.remark ? <div className="we-overnight-remark">{row.remark}</div> : null}
                      </div>
                      <div className="we-overnight-actions">
                        <button
                          type="button"
                          className="we-btn we-btn--approve"
                          disabled={overnightBusy}
                          onClick={() => handleOvernightDecision(row.id, true)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="we-btn-soft we-btn--delete"
                          disabled={overnightBusy}
                          onClick={() => handleOvernightDecision(row.id, false)}
                        >
                          Reject (set 17:00)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </details>
        </section>
        ) : null}
      </div>

      <EditAttendanceModal
        open={editOpen}
        row={editRow}
        onClose={closeEdit}
        onSaved={load}
        onAuthError={onAuthError}
      />
    </div>
  );
}
