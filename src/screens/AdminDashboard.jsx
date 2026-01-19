// src/screens/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listEmployees } from "../api/employees";
import { apiFetch } from "../api/client";
import { fmtDateTime, fmtDateOnly } from "../utils/datetime";

const SUMMARY_ENDPOINT = "/api/AdminDashboard/summary";
const PATCH_LOG_ENDPOINT = (id) => `/api/Attendance/log/${id}`;

const DISPLAY_TZ = import.meta.env.VITE_DISPLAY_TZ || undefined;
// If you force Singapore TZ, we can safely convert datetime-local using +08:00 (no DST).
const FIXED_OFFSET = DISPLAY_TZ === "Asia/Singapore" ? "+08:00" : null;

/* ---------- helpers ---------- */
function fmtHours(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(2)}h`;
}
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
function fmtLatLng(lat, lng) {
  if (lat == null || lng == null) return "—";
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return `${a.toFixed(6)}, ${b.toFixed(6)}`;
}

function mapUrl(lat, lng) {
  if (lat == null || lng == null) return "#";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function toIsoRangeParams(fromDateStr, toDateStr) {
  const qs = new URLSearchParams();

  if (fromDateStr) {
    const d = new Date(`${fromDateStr}T00:00:00`);
    qs.set("from", d.toISOString());
  }
  if (toDateStr) {
    const d = new Date(`${toDateStr}T00:00:00`);
    d.setHours(23, 59, 59, 999);
    qs.set("to", d.toISOString());
  }

  return qs;
}

/** Convert server ISO time -> datetime-local string (YYYY-MM-DDTHH:mm) for the UI TZ */
function isoToDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const y = get("year");
  const m = get("month");
  const day = get("day");
  const hh = get("hour");
  const mm = get("minute");

  if (!y || !m || !day || !hh || !mm) return "";
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * Convert datetime-local string -> DateTimeOffset string.
 * If DISPLAY_TZ is Asia/Singapore => append +08:00
 * else fallback: interpret as browser local -> send UTC ISO "Z"
 */
function dateTimeLocalToOffsetString(dtLocal) {
  if (!dtLocal) return null;
  const withSeconds = dtLocal.length === 16 ? `${dtLocal}:00` : dtLocal;

  if (FIXED_OFFSET) return `${withSeconds}${FIXED_OFFSET}`;

  const d = new Date(withSeconds);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ----- grouping recent activity by day (in DISPLAY_TZ) ----- */
function dayKeyFromLog(a) {
  const v = a?.checkInAt || a?.createdAt || a?.checkOutAt;
  if (!v) return "Unknown";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Unknown";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return y && m && day ? `${y}-${m}-${day}` : "Unknown";
}

function dayLabelFromKey(key) {
  if (!key || key === "Unknown") return "Unknown day";
  const d = new Date(`${key}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: DISPLAY_TZ,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

/* ---------- component ---------- */
export default function AdminDashboard({ onAuthError }) {
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // default last 7 days
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

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

  const employeeStats = useMemo(() => summary?.employeeStats ?? [], [summary]);
  const openSessions = useMemo(() => summary?.openSessions ?? [], [summary]);
  const pendingLeave = useMemo(() => summary?.pendingLeave ?? [], [summary]);
  const recentActivity = useMemo(
    () => summary?.recentActivity ?? [],
    [summary]
  );

  const employeeMap = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(Number(e.id), e);
    return m;
  }, [employees]);

  const allDepartments = useMemo(() => {
    const set = new Set();
    for (const e of employees) {
      if (e?.department) set.add(String(e.department).trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const top = useMemo(() => {
    const totalEmployees =
      typeof summary?.totalEmployees === "number"
        ? summary.totalEmployees
        : employees.length;
    return {
      totalEmployees,
      openCount: openSessions.length,
      pendingLeaveCount: pendingLeave.length,
    };
  }, [summary, employees, openSessions, pendingLeave]);

  // optional: quick search inside stats table
  const [q, setQ] = useState("");
  const [onlyMissingCheckout, setOnlyMissingCheckout] = useState(false);

  const openEmpSet = useMemo(() => {
    return new Set((openSessions || []).map((s) => Number(s.employeeId)));
  }, [openSessions]);

  const filteredStats = useMemo(() => {
    const s = q.trim().toLowerCase();

    let rows = employeeStats.filter((r) => {
      const empId = Number(pick(r, "employeeId", "EmployeeId", "id", "Id"));
      const emp = employeeMap.get(empId);

      const id = String(empId || "");
      const name = String(
        pick(r, "name", "Name") || emp?.name || ""
      ).toLowerCase();
      const dept = String(
        pick(r, "department", "Department") || emp?.department || ""
      ).toLowerCase();

      return !s || id.includes(s) || name.includes(s) || dept.includes(s);
    });

    if (onlyMissingCheckout) {
      rows = rows.filter((r) => {
        const empId = Number(pick(r, "employeeId", "EmployeeId", "id", "Id"));
        return openEmpSet.has(empId);
      });
    }

    return rows;
  }, [q, employeeStats, employeeMap, onlyMissingCheckout, openEmpSet]);

  /* ---------- Recent Activity: filters + compact + details toggle ---------- */
  const [raEmpId, setRaEmpId] = useState("all"); // "all" | id string
  const [raDept, setRaDept] = useState("all"); // "all" | dept string
  const [raSearch, setRaSearch] = useState("");

  const normalizedRecent = useMemo(() => {
    const rows = Array.isArray(recentActivity) ? recentActivity : [];
    return rows.map((a) => {
      const empId = Number(a.employeeId);
      const emp = employeeMap.get(empId);
      return {
        ...a,
        employeeId: empId,
        employeeName:
          a.employeeName || a.name || emp?.name || `Employee #${empId}`,
        department: a.department || emp?.department || "",
      };
    });
  }, [recentActivity, employeeMap]);

  const filteredRecent = useMemo(() => {
    const s = raSearch.trim().toLowerCase();
    return normalizedRecent.filter((a) => {
      if (raEmpId !== "all" && Number(raEmpId) !== Number(a.employeeId))
        return false;
      if (raDept !== "all" && String(a.department || "") !== raDept)
        return false;

      if (!s) return true;
      const inTxt = String(fmtDateTime(a.checkInAt)).toLowerCase();
      const outTxt = String(fmtDateTime(a.checkOutAt)).toLowerCase();
      const name = String(a.employeeName || "").toLowerCase();
      const dept = String(a.department || "").toLowerCase();
      const note = String(a.note || "").toLowerCase();
      const id = String(a.id || "");
      return (
        name.includes(s) ||
        dept.includes(s) ||
        note.includes(s) ||
        inTxt.includes(s) ||
        outTxt.includes(s) ||
        id.includes(s)
      );
    });
  }, [normalizedRecent, raEmpId, raDept, raSearch]);

  const groupedRecent = useMemo(() => {
    const map = new Map();
    for (const a of filteredRecent) {
      const k = dayKeyFromLog(a);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort(
        (x, y) =>
          new Date(y.checkInAt || y.createdAt || 0) -
          new Date(x.checkInAt || x.createdAt || 0)
      );
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filteredRecent]);

  const [showMoreDays, setShowMoreDays] = useState(false);
  const [expandedDays, setExpandedDays] = useState(() => new Set());
  const [openDetails, setOpenDetails] = useState(() => new Set()); // logId set

  function toggleDetails(id) {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---------- Edit modal state ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editClearOut, setEditClearOut] = useState(false);
  const [editNote, setEditNote] = useState("");

  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  function openEditModal(row) {
    setEditErr("");
    setEditRow(row);
    setEditOpen(true);

    setEditCheckIn(isoToDateTimeLocal(row?.checkInAt));
    setEditCheckOut(isoToDateTimeLocal(row?.checkOutAt));
    setEditClearOut(!row?.checkOutAt);
    setEditNote(row?.note ?? "");
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditOpen(false);
    setEditRow(null);
  }

  async function saveEdit() {
    if (!editRow?.id) return;

    setEditSaving(true);
    setEditErr("");
    try {
      const payload = {
        checkInAt: dateTimeLocalToOffsetString(editCheckIn),
        checkOutAt: editClearOut
          ? null
          : dateTimeLocalToOffsetString(editCheckOut),
        clearCheckOut: !!editClearOut,
        note: editNote,
      };

      await apiFetch(PATCH_LOG_ENDPOINT(editRow.id), {
        method: "PATCH",
        auth: true,
        body: payload,
      });

      await load();
      closeEditModal();
    } catch (e) {
      const msg = e?.message || "Failed to save changes";
      if (String(msg).includes("401") || String(msg).includes("403"))
        return onAuthError?.();
      setEditErr(msg);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="we-admin-root">
      {/* background */}
      <div className="we-admin-bg" aria-hidden="true">
        <div className="we-admin-blob we-admin-blob-1" />
        <div className="we-admin-blob we-admin-blob-2" />
        <div className="we-admin-blob we-admin-blob-3" />
        <div className="we-admin-noise" />
      </div>

      <div className="we-admin-wrap">
        {/* header */}
        <div className="we-admin-head">
          <div>
            <div className="we-admin-kicker">Admin overview</div>
            <div className="we-admin-title">Dashboard</div>
            <div className="we-admin-sub">
              Activities • hours • leave • sessions
            </div>
          </div>

          <button className="we-btn" onClick={load} disabled={busy}>
            {busy ? (
              <span className="we-btn-spin">
                <span className="spinner" />
                Loading…
              </span>
            ) : (
              "Refresh"
            )}
          </button>
        </div>

        {/* filters */}
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

            <button className="we-btn-soft" onClick={load} disabled={busy}>
              Apply
            </button>
          </div>

          <div className="we-admin-filterHint">
            Range: <b>{from}</b> → <b>{to}</b>
          </div>
        </div>

        {err ? <div className="we-error">{err}</div> : null}

        {/* top stats */}
        <div className="we-admin-grid">
          <div className="we-glass-card we-admin-stat">
            <div className="we-admin-statTop">
              <div className="we-admin-statLabel">Employees</div>
              <span className="we-admin-pill">ALL</span>
            </div>
            <div className="we-admin-statValue">{top.totalEmployees}</div>
            <div className="we-admin-statHint">Total staff</div>
          </div>

          <div className="we-glass-card we-admin-stat">
            <div className="we-admin-statTop">
              <div className="we-admin-statLabel">Open sessions</div>
              <span className="we-admin-pill open">OPEN</span>
            </div>
            <div className="we-admin-statValue">{top.openCount}</div>
            <div className="we-admin-statHint">Currently clocked-in</div>
          </div>

          <div className="we-glass-card we-admin-stat">
            <div className="we-admin-statTop">
              <div className="we-admin-statLabel">Pending leave</div>
              <span className="we-admin-pill off">PENDING</span>
            </div>
            <div className="we-admin-statValue">{top.pendingLeaveCount}</div>
            <div className="we-admin-statHint">Needs approval</div>
          </div>
        </div>

        {/* employee status */}
        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Employee status</div>
              <div className="we-admin-sectionMeta">
                {filteredStats.length} employees in range
              </div>
            </div>

            <div className="we-admin-search">
              <label className="we-admin-check">
                <input
                  type="checkbox"
                  checked={onlyMissingCheckout}
                  onChange={(e) => setOnlyMissingCheckout(e.target.checked)}
                  disabled={busy}
                />
                Only missing checkout
              </label>
              <span className="we-admin-searchIcon" aria-hidden="true">
                🔎
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name / dept / id"
                disabled={busy}
              />
            </div>
          </div>

          {filteredStats.length === 0 ? (
            <div className="we-admin-empty">
              No stats returned for this range.
            </div>
          ) : (
            <div className="we-admin-tableWrap">
              <table className="we-admin-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th>Days</th>
                    <th>Hours</th>
                    <th>OT</th>
                    <th>Sunday</th>
                    <th>Public Holiday</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((r) => {
                    const empId = Number(
                      pick(r, "employeeId", "EmployeeId", "id", "Id")
                    );
                    const emp = employeeMap.get(empId);

                    const name =
                      pick(r, "name", "Name") || emp?.name || `#${empId}`;
                    const dept =
                      pick(r, "department", "Department") ||
                      emp?.department ||
                      "—";

                    // ✅ read both camelCase + PascalCase
                    const daysWorked = pick(
                      r,
                      "daysWorked",
                      "DaysWorked",
                      "days",
                      "Days"
                    );
                    const totalHours = pick(
                      r,
                      "totalHours",
                      "TotalHours",
                      "hours",
                      "Hours"
                    );
                    const overtimeHours = pick(
                      r,
                      "overtimeHours",
                      "OvertimeHours",
                      "otHours",
                      "OtHours"
                    );
                    const sundayDays = pick(
                      r,
                      "sundayDays",
                      "SundayDays",
                      "sundays",
                      "Sundays"
                    );
                    const publicHolidayDays = pick(
                      r,
                      "publicHolidayDays",
                      "PublicHolidayDays",
                      "holidayDays",
                      "HolidayDays"
                    );

                    return (
                      <tr key={empId}>
                        <td>
                          <div className="we-admin-emp">
                            <div className="we-admin-empName">{name}</div>
                            <div className="we-admin-empId">ID: {empId}</div>
                          </div>
                        </td>
                        <td>{dept}</td>

                        {/* ✅ if backend returns 0, show 0; if missing, show — */}
                        <td>{daysWorked ?? "—"}</td>
                        <td>{fmtHours(totalHours)}</td>
                        <td>{fmtHours(overtimeHours)}</td>
                        <td>{sundayDays ?? "—"}</td>
                        <td>{publicHolidayDays ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* open sessions */}
        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div className="we-admin-sectionTitle">Open sessions</div>
            <div className="we-admin-sectionMeta">{openSessions.length}</div>
          </div>

          {openSessions.length === 0 ? (
            <div className="we-admin-empty">
              No one is currently checked in.
            </div>
          ) : (
            <div className="we-admin-list">
              {openSessions.map((s) => {
                const empId = Number(s.employeeId);
                const emp = employeeMap.get(empId);
                const name =
                  s.employeeName || s.name || emp?.name || `Employee #${empId}`;

                return (
                  <div
                    key={s.id ?? `${empId}:${s.checkInAt || ""}`}
                    className="we-admin-row"
                  >
                    <div className="we-admin-rowTop">
                      <div className="we-admin-name">{name}</div>
                      <span className="we-admin-pill open">OPEN</span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>In:</b> {fmtDateTime(s.checkInAt)}
                      </span>
                      {s.note ? (
                        <>
                          <span className="we-admin-dot">•</span>
                          <span>
                            <b>Note:</b> {s.note}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>Location:</b> {fmtLatLng(s.checkInLat, s.checkInLng)}
                      </span>
                      {s.checkInAccuracyMeters != null ? (
                        <>
                          <span className="we-admin-dot">•</span>
                          <span>
                            <b>±</b>
                            {Number(s.checkInAccuracyMeters).toFixed(0)}m
                          </span>
                        </>
                      ) : null}

                      {s.checkInLat != null && s.checkInLng != null ? (
                        <>
                          <span className="we-admin-dot">•</span>
                          <a
                            className="we-admin-link"
                            href={mapUrl(s.checkInLat, s.checkInLng)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Map
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* pending leave */}
        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div className="we-admin-sectionTitle">Pending leave</div>
            <div className="we-admin-sectionMeta">{pendingLeave.length}</div>
          </div>

          {pendingLeave.length === 0 ? (
            <div className="we-admin-empty">No pending leave requests.</div>
          ) : (
            <div className="we-admin-list">
              {pendingLeave.map((l) => {
                const empId = Number(l.employeeId);
                const emp = employeeMap.get(empId);

                const name =
                  l.employeeName || l.name || emp?.name || `Employee #${empId}`;
                const typeCode = l.leaveTypeCode || l.code || "—";
                const typeName = l.leaveTypeName || l.typeName || "";

                return (
                  <div
                    key={l.id ?? `${empId}:${l.startDate || ""}`}
                    className="we-admin-row"
                  >
                    <div className="we-admin-rowTop">
                      <div className="we-admin-name">{name}</div>
                      <span className="we-admin-pill off">PENDING</span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>Type:</b> {typeCode}{" "}
                        {typeName ? `(${typeName})` : ""}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>From:</b> {fmtDateOnly(l.startDate || l.fromDate)}{" "}
                        <b>To:</b> {fmtDateOnly(l.endDate || l.toDate)}
                      </span>
                    </div>

                    {l.reason ? (
                      <div className="we-admin-meta">
                        <b>Reason:</b> {l.reason}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* recent activity (clean + details toggle + filters) */}
        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Recent activity</div>
              <div className="we-admin-sectionMeta">
                {filteredRecent.length} (filtered) • {recentActivity.length}{" "}
                total
              </div>
            </div>
          </div>

          <div className="we-raFilters">
            <label className="we-raLabel">
              Employee
              <select
                value={raEmpId}
                onChange={(e) => setRaEmpId(e.target.value)}
                disabled={busy}
              >
                <option value="all">All employees</option>
                {employees
                  .slice()
                  .sort((a, b) =>
                    String(a.name || "").localeCompare(String(b.name || ""))
                  )
                  .map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.name || `Employee #${e.id}`}
                    </option>
                  ))}
              </select>
            </label>

            <label className="we-raLabel">
              Department
              <select
                value={raDept}
                onChange={(e) => setRaDept(e.target.value)}
                disabled={busy}
              >
                <option value="all">All departments</option>
                {allDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="we-raLabel we-raSearchWrap">
              Search
              <div className="we-raSearch">
                <span className="we-raSearchIcon" aria-hidden="true">
                  🔎
                </span>
                <input
                  value={raSearch}
                  onChange={(e) => setRaSearch(e.target.value)}
                  placeholder="Name / note / id / date"
                  disabled={busy}
                />
              </div>
            </label>
          </div>

          {groupedRecent.length === 0 ? (
            <div className="we-admin-empty">No activity for this filter.</div>
          ) : (
            <div className="we-dayGroups">
              {(showMoreDays ? groupedRecent : groupedRecent.slice(0, 5)).map(
                ([dayKey, logs]) => {
                  const isExpandedDay = expandedDays.has(dayKey);
                  const visibleLogs = isExpandedDay ? logs : logs.slice(0, 5);
                  const hiddenCount = Math.max(
                    0,
                    logs.length - visibleLogs.length
                  );

                  return (
                    <div key={dayKey} className="we-dayGroup">
                      <button
                        className="we-dayHeader"
                        type="button"
                        onClick={() => {
                          setExpandedDays((prev) => {
                            const next = new Set(prev);
                            if (next.has(dayKey)) next.delete(dayKey);
                            else next.add(dayKey);
                            return next;
                          });
                        }}
                      >
                        <div className="we-dayHeaderLeft">
                          <div className="we-dayTitle">
                            {dayLabelFromKey(dayKey)}
                          </div>
                          <div className="we-daySub">{dayKey}</div>
                        </div>

                        <div className="we-dayHeaderRight">
                          <span className="we-dayCount">
                            {logs.length} logs
                          </span>
                          <span className="we-dayChevron">
                            {isExpandedDay ? "▾" : "▸"}
                          </span>
                        </div>
                      </button>

                      <div className="we-dayList">
                        {visibleLogs.map((a) => {
                          const id = a.id;
                          const show = id != null && openDetails.has(id);

                          const hasInLoc =
                            a.checkInLat != null && a.checkInLng != null;
                          const hasOutLoc =
                            a.checkOutLat != null && a.checkOutLng != null;

                          return (
                            <div
                              key={id ?? `${a.employeeId}:${a.checkInAt || ""}`}
                              className="we-miniRow"
                            >
                              {/* compact header */}
                              <div className="we-miniTopLine">
                                <div className="we-miniName">
                                  {a.employeeName}{" "}
                                  <span className="we-miniId">#{a.id}</span>
                                  {a.department ? (
                                    <span className="we-miniChip">
                                      {a.department}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="we-miniActions">
                                  {a.id ? (
                                    <>
                                      <button
                                        className="we-btn-mini"
                                        type="button"
                                        onClick={() => toggleDetails(a.id)}
                                        disabled={busy}
                                      >
                                        {show ? "Hide" : "Details"}
                                      </button>

                                      <button
                                        className="we-btn-mini primary"
                                        type="button"
                                        onClick={() => openEditModal(a)}
                                        disabled={busy}
                                        title="Edit check-in / check-out"
                                      >
                                        Edit
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              {/* compact times line */}
                              <div className="we-miniMeta">
                                <span>
                                  <b>In:</b> {fmtDateTime(a.checkInAt)}
                                </span>
                                <span className="we-admin-dot">•</span>
                                <span>
                                  <b>Out:</b> {fmtDateTime(a.checkOutAt)}
                                </span>
                              </div>

                              {/* details section */}
                              {show ? (
                                <div className="we-miniDetails">
                                  {a.note ? (
                                    <div className="we-miniDetailRow">
                                      <b>Note:</b>{" "}
                                      <span className="we-miniDetailText">
                                        {a.note}
                                      </span>
                                    </div>
                                  ) : null}

                                  {hasInLoc || hasOutLoc ? (
                                    <div className="we-miniDetailGrid">
                                      <div className="we-miniDetailRow">
                                        <b>In Loc:</b>{" "}
                                        <span className="we-miniDetailText">
                                          {fmtLatLng(
                                            a.checkInLat,
                                            a.checkInLng
                                          )}
                                        </span>
                                        {hasInLoc ? (
                                          <>
                                            <span className="we-admin-dot">
                                              •
                                            </span>
                                            <a
                                              className="we-admin-link"
                                              href={mapUrl(
                                                a.checkInLat,
                                                a.checkInLng
                                              )}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              Map
                                            </a>
                                          </>
                                        ) : null}
                                      </div>

                                      <div className="we-miniDetailRow">
                                        <b>Out Loc:</b>{" "}
                                        <span className="we-miniDetailText">
                                          {fmtLatLng(
                                            a.checkOutLat,
                                            a.checkOutLng
                                          )}
                                        </span>
                                        {hasOutLoc ? (
                                          <>
                                            <span className="we-admin-dot">
                                              •
                                            </span>
                                            <a
                                              className="we-admin-link"
                                              href={mapUrl(
                                                a.checkOutLat,
                                                a.checkOutLng
                                              )}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              Map
                                            </a>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="we-miniDetailDim">
                                      No location captured.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {!isExpandedDay && hiddenCount > 0 ? (
                        <button
                          className="we-showMoreInDay"
                          type="button"
                          onClick={() => {
                            setExpandedDays((prev) => {
                              const next = new Set(prev);
                              next.add(dayKey);
                              return next;
                            });
                          }}
                        >
                          Show {hiddenCount} more for this day
                        </button>
                      ) : null}
                    </div>
                  );
                }
              )}

              {groupedRecent.length > 5 ? (
                <button
                  className="we-showMoreDays"
                  type="button"
                  onClick={() => setShowMoreDays((v) => !v)}
                >
                  {showMoreDays
                    ? "Show fewer days"
                    : `Show more days (${groupedRecent.length - 5} more)`}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ---- Edit Modal ---- */}
      {editOpen ? (
        <div
          className="we-modalBack"
          role="dialog"
          aria-modal="true"
          onMouseDown={closeEditModal}
        >
          <div className="we-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="we-modalHead">
              <div>
                <div className="we-modalTitle">Edit attendance</div>
                <div className="we-modalSub">
                  Log #{editRow?.id} • Employee #{editRow?.employeeId}
                </div>
              </div>
              <button
                className="we-btn-x"
                onClick={closeEditModal}
                disabled={editSaving}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="we-modalBody">
              <label className="we-modalLabel">
                Check-in time
                <input
                  type="datetime-local"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                  disabled={editSaving}
                />
              </label>

              <label className="we-modalLabel">
                Check-out time
                <input
                  type="datetime-local"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                  disabled={editSaving || editClearOut}
                />
              </label>

              <label className="we-modalCheck">
                <input
                  type="checkbox"
                  checked={editClearOut}
                  onChange={(e) => setEditClearOut(e.target.checked)}
                  disabled={editSaving}
                />
                Clear check-out (set CheckOutAt = null)
              </label>

              <label className="we-modalLabel">
                Note
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Optional note"
                  disabled={editSaving}
                />
              </label>

              <div className="we-modalHint">
                Display TZ: <b>{DISPLAY_TZ || "Browser local"}</b>
                {FIXED_OFFSET ? (
                  <>
                    {" "}
                    • Saving as <b>{FIXED_OFFSET}</b> offset
                  </>
                ) : (
                  <> • Saving using browser local → UTC</>
                )}
              </div>

              {editErr ? <div className="we-error">{editErr}</div> : null}
            </div>

            <div className="we-modalFoot">
              <button
                className="we-btn-soft"
                onClick={closeEditModal}
                disabled={editSaving}
                type="button"
              >
                Cancel
              </button>
              <button
                className="we-btn"
                onClick={saveEdit}
                disabled={editSaving}
                type="button"
              >
                {editSaving ? (
                  <span className="we-btn-spin">
                    <span className="spinner" />
                    Saving…
                  </span>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{css}</style>
    </div>
  );
}

/* ---------- CSS ---------- */
const css = `
.we-admin-root{ position:relative; overflow:hidden; }
.we-admin-bg{ position:fixed; inset:0; z-index:0; background:#0b1220; }
.we-admin-blob{
  position:absolute; width:560px; height:560px;
  filter: blur(70px); opacity:.55; border-radius:999px;
}
.we-admin-blob-1{ top:-220px; left:-220px; background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%); }
.we-admin-blob-2{ bottom:-260px; right:-220px; background: radial-gradient(circle at 30% 30%, #22c55e, transparent 55%); }
.we-admin-blob-3{ top:25%; right:-280px; background: radial-gradient(circle at 30% 30%, #06b6d4, transparent 55%); }
.we-admin-noise{
  position:absolute; inset:0; opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}
.we-admin-wrap{ position:relative; z-index:1; display:grid; gap:12px; color:#e5e7eb; }

/* header */
.we-admin-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.we-admin-kicker{ font-size:12px; opacity:.75; }
.we-admin-title{ margin-top:2px; font-size:26px; font-weight:950; color:#fff; line-height:1.1; }
.we-admin-sub{ margin-top:6px; font-size:12px; color: rgba(226,232,240,.75); }

/* glass */
.we-glass-card{
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.16);
  box-shadow: 0 30px 80px rgba(0,0,0,.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 18px;
  padding: 14px;
}

/* filters */
.we-admin-filters{ padding: 12px 14px; }
.we-admin-filterRow{
  display:flex;
  gap:10px;
  align-items:flex-end;
  flex-wrap: wrap;
}
.we-admin-filterLabel{
  display:grid;
  gap:6px;
  font-size:12px;
  font-weight:900;
  opacity:.9;
}
.we-admin-filterLabel input{
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(15,23,42,.35);
  color:#fff;
  padding: 0 10px;
}
.we-admin-filterHint{
  margin-top: 8px;
  font-size: 12px;
  opacity: .78;
}

.we-admin-grid{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap:12px;
}
.we-admin-statTop{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.we-admin-statLabel{ font-size:12px; opacity:.8; font-weight:900; }
.we-admin-statValue{ margin-top:8px; font-size:34px; font-weight:950; color:#fff; }
.we-admin-statHint{ margin-top:6px; font-size:12px; opacity:.75; }

.we-admin-pill{
  padding:6px 10px; border-radius:999px;
  font-size:12px; font-weight:900;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.08);
}
.we-admin-pill.open{ background: rgba(34,197,94,.14); border-color: rgba(34,197,94,.28); color:#bbf7d0; }
.we-admin-pill.off{ background: rgba(244,63,94,.14); border-color: rgba(244,63,94,.28); color:#fecdd3; }

.we-admin-sectionHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  gap:10px;
  margin-bottom:10px;
}
.we-admin-sectionTitle{ font-size:14px; font-weight:950; color:#fff; }
.we-admin-sectionMeta{ font-size:12px; opacity:.75; }

.we-admin-empty{ font-size:13px; opacity:.78; }

/* search */
.we-admin-search{
  display:flex; align-items:center; gap:8px;
  padding:10px 10px;
  border-radius:14px;
  background: rgba(15,23,42,.35);
  border:1px solid rgba(255,255,255,.12);
}
.we-admin-search input{
  border:0; outline:0; background:transparent; color:#fff; width: 220px;
}
.we-admin-searchIcon{ opacity:.85; }

/* table */
.we-admin-tableWrap{
  overflow:auto;
  border-radius: 14px;
  border:1px solid rgba(255,255,255,.12);
}
.we-admin-table{
  width:100%;
  border-collapse: collapse;
  min-width: 760px;
  background: rgba(15,23,42,.22);
}
.we-admin-table th, .we-admin-table td{
  padding: 10px 10px;
  font-size: 12px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  vertical-align: top;
}
.we-admin-table th{
  text-align:left;
  font-weight: 950;
  color:#fff;
  background: rgba(255,255,255,.06);
  position: sticky;
  top: 0;
}
.we-admin-empName{ font-weight: 950; color:#fff; }
.we-admin-empId{ font-size: 11px; opacity: .75; margin-top: 2px; }

.we-admin-dot{ opacity:.5; }
.we-admin-link{ color:#a5b4fc; text-decoration:none; font-weight:900; }
.we-admin-link:hover{ text-decoration:underline; }

/* buttons + error */
.we-btn{
  border:0;
  border-radius:14px;
  padding:10px 14px;
  background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1));
  color:#fff;
  font-weight:900;
  cursor:pointer;
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
}
.we-btn:disabled{ opacity:.6; cursor:not-allowed; }

.we-btn-soft{
  border-radius:14px;
  padding:10px 14px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  color:#fff;
  font-weight:900;
  cursor:pointer;
}
.we-btn-soft:disabled{ opacity:.6; cursor:not-allowed; }

.we-btn-spin{ display:flex; align-items:center; gap:10px; }
.spinner{
  width:16px;height:16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.45);
  border-top-color:#fff;
  animation: spin .9s linear infinite;
}
@keyframes spin{ to{ transform: rotate(360deg); } }

.we-error{
  background: rgba(244,63,94,.14);
  border:1px solid rgba(244,63,94,.28);
  color:#fecdd3;
  border-radius:16px;
  padding:10px 12px;
  font-size:12px;
  font-weight:800;
  word-break: break-word;
}

/* ===== Recent Activity filters ===== */
.we-raFilters{
  display:grid;
  grid-template-columns: 180px 180px 1fr;
  gap:10px;
  margin-bottom: 10px;
}
.we-raLabel{
  display:grid;
  gap:6px;
  font-size:12px;
  font-weight:900;
  opacity:.9;
}
  .we-admin-check{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
  font-weight:900;
  opacity:.9;
  user-select:none;
}
.we-admin-check input{
  width:16px;
  height:16px;
  accent-color: #a5b4fc;
}
.we-raLabel select{
  height:40px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(15,23,42,.35);
  color:#fff;
  padding: 0 10px;
}
.we-raSearchWrap{ min-width: 0; }
.we-raSearch{
  display:flex;
  align-items:center;
  gap:8px;
  padding:10px 10px;
  border-radius:14px;
  background: rgba(15,23,42,.35);
  border:1px solid rgba(255,255,255,.12);
}
.we-raSearch input{
  border:0; outline:0; background:transparent; color:#fff; width: 100%;
  min-width:0;
}
.we-raSearchIcon{ opacity:.85; }

/* ===== Grouped Recent Activity ===== */
.we-dayGroups{ display:grid; gap:10px; }
.we-dayGroup{
  border:1px solid rgba(255,255,255,.12);
  border-radius:16px;
  overflow:hidden;
  background: rgba(15,23,42,.20);
}
.we-dayHeader{
  width:100%;
  border:0;
  background: rgba(255,255,255,.06);
  color:#fff;
  padding:12px 12px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  cursor:pointer;
}
.we-dayHeaderLeft{ display:grid; gap:2px; text-align:left; }
.we-dayTitle{ font-weight:950; font-size:13px; }
.we-daySub{ font-size:12px; opacity:.7; }
.we-dayHeaderRight{ display:flex; align-items:center; gap:10px; }
.we-dayCount{
  font-size:12px;
  opacity:.8;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
}
.we-dayChevron{ opacity:.8; font-size:14px; }

.we-dayList{ padding:10px; display:grid; gap:8px; }

.we-miniRow{
  padding:10px;
  border-radius:14px;
  background: rgba(15,23,42,.28);
  border:1px solid rgba(255,255,255,.10);
}
.we-miniTopLine{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}
.we-miniName{
  font-weight:950;
  color:#fff;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.we-miniId{ opacity:.7; font-weight:900; margin-left:6px; }
.we-miniChip{
  margin-left:8px;
  padding:4px 8px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(226,232,240,.9);
}

.we-miniMeta{
  margin-top:6px;
  font-size:12px;
  opacity:.88;
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.we-miniActions{ display:flex; align-items:center; gap:8px; }

.we-btn-mini{
  border-radius:12px;
  padding:7px 10px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color:#fff;
  font-weight:950;
  cursor:pointer;
  font-size:12px;
}
.we-btn-mini.primary{
  border-color: rgba(165,180,252,.35);
  background: rgba(165,180,252,.14);
}
.we-btn-mini:disabled{ opacity:.6; cursor:not-allowed; }

.we-miniDetails{
  margin-top:10px;
  padding-top:10px;
  border-top: 1px dashed rgba(255,255,255,.14);
  display:grid;
  gap:8px;
}
.we-miniDetailRow{
  font-size:12px;
  opacity:.9;
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  align-items:baseline;
}
.we-miniDetailText{
  opacity:.9;
  word-break: break-word;
}
.we-miniDetailGrid{
  display:grid;
  gap:8px;
}
.we-miniDetailDim{
  font-size:12px;
  opacity:.7;
}

.we-showMoreInDay, .we-showMoreDays{
  width:100%;
  border:0;
  cursor:pointer;
  padding:10px 12px;
  background: rgba(255,255,255,.06);
  border-top: 1px solid rgba(255,255,255,.10);
  color:#fff;
  font-weight:900;
  font-size:12px;
}
.we-showMoreDays{
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  margin-top: 4px;
}

/* ===== Modal ===== */
.we-modalBack{
  position:fixed; inset:0; z-index:50;
  background: rgba(0,0,0,.55);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 18px;
}
.we-modal{
  width:min(520px, 100%);
  background: rgba(15,23,42,.95);
  border:1px solid rgba(255,255,255,.14);
  border-radius:18px;
  box-shadow: 0 30px 120px rgba(0,0,0,.6);
  overflow:hidden;
}
.we-modalHead{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:12px;
  padding:14px;
  border-bottom:1px solid rgba(255,255,255,.10);
}
.we-modalTitle{ font-weight:950; color:#fff; font-size:16px; }
.we-modalSub{ font-size:12px; opacity:.75; margin-top:4px; }
.we-btn-x{
  border:0;
  width:38px; height:38px;
  border-radius:14px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  color:#fff;
  cursor:pointer;
  font-weight:950;
}
.we-btn-x:disabled{ opacity:.6; cursor:not-allowed; }

.we-modalBody{ padding:14px; display:grid; gap:10px; }
.we-modalLabel{
  display:grid;
  gap:6px;
  font-size:12px;
  font-weight:900;
  opacity:.9;
}
.we-modalLabel input{
  height:40px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(15,23,42,.35);
  color:#fff;
  padding: 0 10px;
}
.we-modalCheck{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
  opacity:.9;
}
.we-modalHint{
  margin-top:6px;
  font-size:12px;
  opacity:.78;
}
.we-modalFoot{
  display:flex;
  gap:10px;
  padding:14px;
  border-top:1px solid rgba(255,255,255,.10);
}
.we-modalFoot > *{ flex:1; }

@media (max-width: 980px){
  .we-raFilters{
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px){
  .we-admin-grid{ grid-template-columns: 1fr; }
  .we-admin-title{ font-size:24px; }
}
`;
