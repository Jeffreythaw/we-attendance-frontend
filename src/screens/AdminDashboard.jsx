import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listEmployees } from "../api/employees";
import { apiFetch } from "../api/client";
import { fmtDateTime } from "../utils/datetime";
import {
  formatDurationMinutes,
  hasReportMetrics,
  pickReportMonFriOtMinutes,
  pickReportOtMinutes,
  pickReportOvernightOtMinutes,
  pickReportSatOtMinutes,
  pickReportSunPhOtMinutes,
  pickReportWorkedMinutes,
} from "../utils/attendanceFormat";

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
  const [preApproveDate, setPreApproveDate] = useState(() => localIsoDate(new Date()));
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

      const safeOtMins = pickReportOtMinutes(r);
      const totalMins = hasReportMetrics(r)
        ? pickReportWorkedMinutes(r)
        : Math.max(0, Math.round((finiteNumberOrNull(r?.regularMinutes) ?? 0) + safeOtMins));
      totalWorkedByEmp.set(empId, (totalWorkedByEmp.get(empId) || 0) + totalMins);
      otByEmp.set(empId, (otByEmp.get(empId) || 0) + safeOtMins);

      if (safeOtMins > 0) {
        if (hasReportMetrics(r)) {
          normalOtByEmp.set(empId, (normalOtByEmp.get(empId) || 0) + pickReportMonFriOtMinutes(r) + pickReportSatOtMinutes(r));
          sunPhOtByEmp.set(empId, (sunPhOtByEmp.get(empId) || 0) + pickReportSunPhOtMinutes(r));
          overnightOtByEmp.set(empId, (overnightOtByEmp.get(empId) || 0) + pickReportOvernightOtMinutes(r));
        } else {
          const offDay = !workdaySet.has(dayKey);
          const outDayKey = toDateKey(outAt);
          const overnight = !!(outDayKey && outDayKey !== dayKey);
          if (offDay) sunPhOtByEmp.set(empId, (sunPhOtByEmp.get(empId) || 0) + safeOtMins);
          else normalOtByEmp.set(empId, (normalOtByEmp.get(empId) || 0) + safeOtMins);
          if (overnight) overnightOtByEmp.set(empId, (overnightOtByEmp.get(empId) || 0) + safeOtMins);
        }
      }
    }

    const orderedEmployees = [...employees].sort((a, b) => {
      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      const byName = an.localeCompare(bn);
      if (byName !== 0) return byName;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });

    return orderedEmployees.map((e) => {
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
    const presentDays = employeeInsights.reduce((total, employee) => total + (employee.presentDays || 0), 0);
    const absentDays = employeeInsights.reduce((total, employee) => total + (employee.absentDays || 0), 0);
    const attendanceRate = Math.max(0, Math.min(100, Math.round((presentDays / attendanceDenom) * 100)));
    const absentRate = Math.max(0, Math.min(100, Math.round((absentDays / absenceDenom) * 100)));
    const overtimeRate = totalWorked > 0 ? Math.max(0, Math.min(100, Math.round((totalOt / totalWorked) * 100))) : 0;

    return {
      attendanceRate,
      absentRate,
      overtimeRate,
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
        <div className="we-glass-card we-admin-hero we-ops-hero">
          <div className="we-ops-heroIntro">
            <div>
              <div className="we-ops-eyebrow">Operations control</div>
              <div className="we-admin-title">Workforce dashboard</div>
              <div className="we-admin-sub">See attendance health, approval work, and overtime in one place.</div>
            </div>
            <div className="we-ops-period">
              <span>Selected period</span>
              <strong>{from} → {to}</strong>
            </div>
          </div>

          <div className="we-ops-toolbar">
            <div className="we-admin-filterQuick" aria-label="Quick date range">
              <button className="we-btn-chip" type="button" onClick={setThisWeek} disabled={busy}>This week</button>
              <button className="we-btn-chip" type="button" onClick={setThisMonth} disabled={busy}>This month</button>
              <button className="we-btn-chip ghost" type="button" onClick={setLastMonth} disabled={busy}>Last month</button>
            </div>
            <button className="we-btn we-btn--refresh" onClick={() => load({ from, to })} disabled={busy}>
              {busy ? "Loading…" : "Refresh data"}
            </button>
          </div>

          <div className="we-ops-controls">
            <div className="we-admin-filterRow">
              <label className="we-admin-filterLabel">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy} />
              </label>
              <label className="we-admin-filterLabel">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} />
              </label>
              <button className="we-btn-soft we-btn--apply" onClick={() => load({ from, to })} disabled={busy} type="button">Apply range</button>
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
        <section className="we-admin-block we-ops-overview">
          <div className="we-ops-sectionHead">
            <div>
              <div className="we-admin-blockTitle">Workforce overview</div>
              <div className="we-admin-sectionMeta">The essentials for the selected period.</div>
            </div>
            <span className="we-ops-liveDot">Live summary</span>
          </div>

          <div className="we-ops-kpiGrid">
            <article className="we-ops-kpi success">
              <div className="we-ops-kpiIcon" aria-hidden="true">✓</div>
              <div><div className="we-ops-kpiLabel">Attendance</div><div className="we-ops-kpiValue">{insightBreakdown.attendanceRate}%</div><div className="we-ops-kpiHint">Present days in this period</div></div>
            </article>
            <article className="we-ops-kpi warning">
              <div className="we-ops-kpiIcon" aria-hidden="true">↗</div>
              <div><div className="we-ops-kpiLabel">Overtime</div><div className="we-ops-kpiValue">{formatHm(insightBreakdown.totalOtMinutes)}</div><div className="we-ops-kpiHint">{insightBreakdown.overtimeRate}% of worked time</div></div>
            </article>
            <article className="we-ops-kpi danger">
              <div className="we-ops-kpiIcon" aria-hidden="true">!</div>
              <div><div className="we-ops-kpiLabel">Absence</div><div className="we-ops-kpiValue">{insightBreakdown.absentRate}%</div><div className="we-ops-kpiHint">Workdays only</div></div>
            </article>
            <article className="we-ops-kpi neutral">
              <div className="we-ops-kpiIcon" aria-hidden="true">♟</div>
              <div><div className="we-ops-kpiLabel">Active staff</div><div className="we-ops-kpiValue">{employees.length}</div><div className="we-ops-kpiHint">Employees in the system</div></div>
            </article>
          </div>

          <div className="we-ops-mainGrid">
            <section className="we-glass-card we-ops-queue">
              <div className="we-ops-cardHead"><div><div className="we-admin-sectionTitle">Needs attention</div><div className="we-admin-sectionMeta">Approve time-sensitive items first.</div></div><span className="we-ops-count">{overnightPending.length + (Array.isArray(summary?.pendingLeave) ? summary.pendingLeave.length : 0)}</span></div>
              <div className="we-ops-queueItem"><div><strong>Overnight OT</strong><span>{overnightPending.length} pending request{overnightPending.length === 1 ? "" : "s"}</span></div><button type="button" className="we-btn-soft" onClick={() => setViewMode("reports")}>Review</button></div>
              <div className="we-ops-queueItem"><div><strong>Leave requests</strong><span>{Array.isArray(summary?.pendingLeave) ? summary.pendingLeave.length : 0} awaiting approval</span></div><span className="we-ops-status">Check leave</span></div>
              <button type="button" className="we-ops-linkBtn" onClick={() => setViewMode("attendance")}>Open attendance board →</button>
            </section>

            <section className="we-glass-card we-ops-health">
              <div className="we-admin-sectionTitle">Attendance health</div>
              <div className="we-admin-sectionMeta">A quick read of this period, without opening a report.</div>
              <div className="we-ops-meter"><div><span>Attendance rate</span><strong>{insightBreakdown.attendanceRate}%</strong></div><i><b style={{ width: `${insightBreakdown.attendanceRate}%` }} /></i></div>
              <div className="we-ops-meter warning"><div><span>Overtime share</span><strong>{insightBreakdown.overtimeRate}%</strong></div><i><b style={{ width: `${insightBreakdown.overtimeRate}%` }} /></i></div>
              <div className="we-ops-meter danger"><div><span>Absence rate</span><strong>{insightBreakdown.absentRate}%</strong></div><i><b style={{ width: `${insightBreakdown.absentRate}%` }} /></i></div>
            </section>
          </div>

          <div className="we-glass-card we-admin-preapprove we-ops-preapprove">
            <div className="we-admin-sectionHead">
              <div>
                <div className="we-admin-sectionTitle">Quick Overnight Pre-approvals</div>
                <div className="we-admin-sectionMeta">Set approved overnight work before the employee clocks in.</div>
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
