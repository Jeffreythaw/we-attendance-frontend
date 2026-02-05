import React, { useEffect, useMemo, useRef, useState } from "react";
import { listEmployees } from "../api/employees";
import { apiFetch } from "../api/client";
import { fmtDateTime, fmtDateOnly } from "../utils/datetime";

import { SUMMARY_ENDPOINT, INSIGHTS_ENDPOINT } from "./adminDashboard/constants";
import { toIsoRangeParams } from "./adminDashboard/timezone";

import AttendanceReport from "./adminDashboard/AttendanceReport";
import RecentActivity from "./adminDashboard/RecentActivity";
import EmployeeInOutMatrix from "./adminDashboard/EmployeeInOutMatrix";
import EditAttendanceModal from "./adminDashboard/EditAttendanceModal";

// ✅ split CSS files (no more styles.js)
import "./adminDashboard/styles/base.css";
import "./adminDashboard/styles/summary.css";
import "./adminDashboard/styles/matrix.css";
import "./adminDashboard/styles/report.css";
import "./adminDashboard/styles/recentActivity.css";
import "./adminDashboard/styles/modal.css";

/** YYYY-MM-DD in Singapore time */
const SG_TZ = "Asia/Singapore";

function parseIsoDateInput(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return { y, m, d };
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

function SummaryTile({ label, value, hint, pillClass, pillText }) {
  return (
    <div className="we-summaryTile">
      <div className="we-summaryTop">
        <div className="we-summaryLabel">{label}</div>
        {pillText ? (
          <span className={`we-admin-pill ${pillClass || ""}`}>{pillText}</span>
        ) : null}
      </div>
      <div className="we-summaryValue">{value}</div>
      {hint ? <div className="we-summaryHint">{hint}</div> : null}
    </div>
  );
}

export default function AdminDashboard({ onAuthError }) {
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [insights, setInsights] = useState(null);
  const [overnightPending, setOvernightPending] = useState([]);
  const [overnightBusy, setOvernightBusy] = useState(false);
  const [preApprovals, setPreApprovals] = useState([]);
  const [preApproveEmployeeId, setPreApproveEmployeeId] = useState("");
  const [preApproveDate, setPreApproveDate] = useState(() => sgWeekRangeIso(new Date()).fromIso);
  const [preApproveNote, setPreApproveNote] = useState("");
  const [preApproveBusy, setPreApproveBusy] = useState(false);

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

  async function load() {
    setErr("");
    setBusy(true);
    try {
      const f = from && to && from > to ? to : from;
      const t = from && to && from > to ? from : to;

      const qs = toIsoRangeParams(f, t);
      const [emps, sum, ins, pending, pre] = await Promise.all([
        listEmployees(true),
        apiFetch(`${SUMMARY_ENDPOINT}?${qs.toString()}`, {
          method: "GET",
          auth: true,
        }),
        apiFetch(INSIGHTS_ENDPOINT, { method: "GET", auth: true }),
        apiFetch("/api/Attendance/overnight/pending", { method: "GET", auth: true }),
        apiFetch(`/api/Attendance/overnight/preapprove?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`, { method: "GET", auth: true }),
      ]);

      if (!mountedRef.current) return;
      setEmployees(Array.isArray(emps) ? emps : []);
      setSummary(sum || null);
      setInsights(ins || null);
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
  }

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
      setPreApproveNote("");
      await load();
    } catch (e) {
      const msg = e?.message || "Failed to create pre-approval";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      setErr(msg);
    } finally {
      setPreApproveBusy(false);
    }
  }

  async function handleDeletePreApproval(id) {
    setPreApproveBusy(true);
    try {
      await apiFetch(`/api/Attendance/overnight/preapprove/${encodeURIComponent(id)}`, {
        method: "DELETE",
        auth: true,
      });
      await load();
    } catch (e) {
      const msg = e?.message || "Failed to remove pre-approval";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      setErr(msg);
    } finally {
      setPreApproveBusy(false);
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
      await load();
    } catch (e) {
      const msg = e?.message || "Failed to update overnight approval";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      setErr(msg);
    } finally {
      setOvernightBusy(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSessions = useMemo(() => summary?.openSessions ?? [], [summary]);
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

  const totalEmployees = useMemo(() => {
    return typeof summary?.totalEmployees === "number"
      ? summary.totalEmployees
      : employees.length;
  }, [summary, employees]);

  const openCount = openSessions.length;
  const notClockedIn = Math.max(0, totalEmployees - openCount);

  const glance = useMemo(() => {
    const rows = Array.isArray(recentActivity) ? recentActivity : [];
    let late = 0;
    let missingIn = 0;
    let missingOut = 0;

    for (const r of rows) {
      const inAt = r?.checkInAt ?? r?.inAt ?? r?.clockInAt ?? r?.startAt ?? r?.timeIn ?? null;
      const outAt = r?.checkOutAt ?? r?.outAt ?? r?.clockOutAt ?? r?.endAt ?? r?.timeOut ?? null;
      const dayKey = toDateKey(r?.date ?? r?.day ?? r?.workDate ?? inAt ?? outAt);
      if (!dayKey) continue;
      if (dayKey < from || dayKey > to) continue;

      if (inAt && !outAt) missingOut += 1;
      if (!inAt && outAt) missingIn += 1;
      if (inAt && isLate(inAt)) late += 1;
    }

    return { late, missingIn, missingOut };
  }, [recentActivity, from, to]);

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
    <div className="we-admin-root">
      <div className="we-admin-bg" aria-hidden="true">
        <div className="we-admin-blob we-admin-blob-1" />
        <div className="we-admin-blob we-admin-blob-2" />
        <div className="we-admin-blob we-admin-blob-3" />
        <div className="we-admin-noise" />
      </div>

      <div className="we-admin-wrap">
        <div className="we-admin-sticky">
          <div className="we-admin-head">
            <div>
              <div className="we-admin-kicker">Admin overview</div>
              <div className="we-admin-title">Dashboard</div>
              <div className="we-admin-sub">
                Activities • hours • leave • sessions
              </div>
            </div>

            <button className="we-btn" onClick={load} disabled={busy}>
              {busy ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="we-glass-card we-admin-filters">
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
              className="we-btn-soft"
              onClick={load}
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
        </div>

        {err ? <div className="we-error">{err}</div> : null}

        {/* Attendance Insights */}
        <div className="we-glass-card we-admin-charts">
          <div className="we-admin-chartsHead">
            <div>
              <div className="we-admin-sectionTitle">Attendance Insights</div>
              <div className="we-admin-sectionMeta">Donut overview (last 7 days)</div>
            </div>
            <div className="we-admin-kpiMini">
              <div className="k">Employees</div><div className="v">{totalEmployees}</div>
              <div className="k">Present</div><div className="v">{openCount}</div>
              <div className="k">Absent</div><div className="v">{notClockedIn}</div>
              <div className="k">Late</div><div className="v">{glance.late}</div>
            </div>
          </div>
          <div className="we-admin-donutGrid">
            {(() => {
              const active = insights?.activeEmployees || 0;
              const abs7 = (insights?.absenteesLast7Days || []).reduce((a, d) => a + (d.value || 0), 0);
              const late7 = (insights?.lateLast7Days || []).reduce((a, d) => a + (d.value || 0), 0);
              const totalDays = (insights?.absenteesLast7Days || []).length || 1;
              const maxPossible = active * totalDays;
              const attendanceRate = maxPossible > 0 ? Math.round(((maxPossible - abs7) / maxPossible) * 100) : 0;
              const lateRate = maxPossible > 0 ? Math.round((late7 / maxPossible) * 100) : 0;
              const absentRate = maxPossible > 0 ? Math.round((abs7 / maxPossible) * 100) : 0;
              return (
                <>
                  <div className="we-admin-donutCard">
                    <div className="we-admin-chartTitle">Attendance rate</div>
                    <div className="we-admin-donutWrap">
                      <div className="we-admin-donut" style={{ '--pct': `${attendanceRate}%` }} />
                      <div className="we-admin-donutCenter">
                        <div className="v">{attendanceRate}%</div>
                        <div className="k">Present</div>
                      </div>
                    </div>
                    <div className="we-admin-donutNote">Based on last 7 days</div>
                  </div>
                  <div className="we-admin-donutCard">
                    <div className="we-admin-chartTitle">Late rate</div>
                    <div className="we-admin-donutWrap">
                      <div className="we-admin-donut warn" style={{ '--pct': `${lateRate}%` }} />
                      <div className="we-admin-donutCenter">
                        <div className="v">{lateRate}%</div>
                        <div className="k">Late</div>
                      </div>
                    </div>
                    <div className="we-admin-donutNote">Late after 08:15</div>
                  </div>
                  <div className="we-admin-donutCard">
                    <div className="we-admin-chartTitle">Absence rate</div>
                    <div className="we-admin-donutWrap">
                      <div className="we-admin-donut alt" style={{ '--pct': `${absentRate}%` }} />
                      <div className="we-admin-donutCenter">
                        <div className="v">{absentRate}%</div>
                        <div className="k">Absent</div>
                      </div>
                    </div>
                    <div className="we-admin-donutNote">Active staff only</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Overnight pre-approvals */}
        <div className="we-glass-card we-admin-preapprove">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Overnight pre-approvals</div>
              <div className="we-admin-sectionMeta">Allow specific employees to work overnight on a date</div>
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
              className="we-btn"
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
                      className="we-btn-soft"
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

        {/* Overnight approvals */}
        <div className="we-glass-card we-admin-overnight">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Overnight OT approvals</div>
              <div className="we-admin-sectionMeta">Pending checkouts after midnight</div>
            </div>
            <div className="we-admin-sectionMeta">{overnightPending.length} pending</div>
          </div>

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
                        className="we-btn"
                        disabled={overnightBusy}
                        onClick={() => handleOvernightDecision(row.id, true)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="we-btn-soft"
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
        </div>

        {/* Presence Board */}
        <EmployeeInOutMatrix
          from={from}
          to={to}
          recentActivity={recentActivity}
          employeeMap={employeeMap}
          employees={employees}
          defaultSelectedCount={3}
          onEdit={openEdit}
        />

        {/* Recent Activity */}
        <RecentActivity
          recentActivity={recentActivity}
          employees={employees}
          allDepartments={allDepartments}
          employeeMap={employeeMap}
          busy={busy}
          onEdit={openEdit}
          onlyTodayByDefault={true}
          fmtDateTime={fmtDateTime}
          fmtDateOnly={fmtDateOnly}
        />

        {/* Attendance report */}
        <AttendanceReport from={from} to={to} disabled={busy} onAuthError={onAuthError} />
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