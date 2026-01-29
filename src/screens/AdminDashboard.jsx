import React, { useEffect, useMemo, useState } from "react";
import { listEmployees } from "../api/employees";
import { apiFetch } from "../api/client";
import { fmtDateTime, fmtDateOnly } from "../utils/datetime";

import { SUMMARY_ENDPOINT } from "./adminDashboard/constants";
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

/** local YYYY-MM-DD (not UTC) */
function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localIsoDate(d);
  });
  const [to, setTo] = useState(() => localIsoDate(new Date()));

  async function load() {
    setErr("");
    setBusy(true);
    try {
      const qs = toIsoRangeParams(from, to);
      const [emps, sum] = await Promise.all([
        listEmployees(true),
        apiFetch(`${SUMMARY_ENDPOINT}?${qs.toString()}`, {
          method: "GET",
          auth: true,
        }),
      ]);

      setEmployees(Array.isArray(emps) ? emps : []);
      setSummary(sum || null);
    } catch (e) {
      const msg = e?.message || "Failed to load dashboard";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSessions = useMemo(() => summary?.openSessions ?? [], [summary]);
  const pendingLeave = useMemo(() => summary?.pendingLeave ?? [], [summary]);
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
  const pendingLeaveCount = pendingLeave.length;

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

          <div className="we-admin-filterHint">
            Range: <b>{from}</b> → <b>{to}</b>
          </div>
        </div>

        {err ? <div className="we-error">{err}</div> : null}

        {/* Summary */}
        <div className="we-glass-card we-summaryCard">
          <div className="we-summaryGrid">
            <SummaryTile label="Employees" value={totalEmployees} hint="Total staff" pillText="ALL" />
            <SummaryTile label="Clocked-in" value={openCount} hint="Currently in" pillClass="open" pillText="IN" />
            <SummaryTile label="Not clocked-in" value={notClockedIn} hint="Employees not in" pillClass="off" pillText="OUT" />
            <SummaryTile label="Pending leave" value={pendingLeaveCount} hint="Needs approval" pillClass="off" pillText="PENDING" />
          </div>
        </div>

        {/* Matrix */}
        <EmployeeInOutMatrix
          from={from}
          to={to}
          recentActivity={recentActivity}
          employeeMap={employeeMap}
          employees={employees}
          defaultSelectedCount={3}
        />

        {/* Attendance report */}
        <AttendanceReport from={from} to={to} disabled={busy} onAuthError={onAuthError} />

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