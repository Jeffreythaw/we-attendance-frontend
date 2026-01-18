// src/screens/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listEmployees } from "../api/employees";
import { apiFetch } from "../api/client";
import { fmtDateTime, fmtDateOnly } from "../utils/datetime";

const SUMMARY_ENDPOINT = "/api/AdminDashboard/summary";

function fmtHours(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(2)}h`;
}

function fmtLatLng(lat, lng) {
  if (lat == null || lng == null) return "—";
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return `${a.toFixed(6)}, ${b.toFixed(6)}`;
}

function toIsoRangeParams(fromDateStr, toDateStr) {
  // from/to are from <input type="date"> => "YYYY-MM-DD"
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

/* ---------- component ---------- */
export default function AdminDashboard({ onAuthError }) {
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // default to last 7 days
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
        listEmployees(true), // include inactive so lookup always works
        apiFetch(`${SUMMARY_ENDPOINT}?${qs.toString()}`, { method: "GET", auth: true }),
      ]);

      setEmployees(Array.isArray(emps) ? emps : []);
      setSummary(sum || null);
    } catch (e) {
      const msg = e?.message || "Failed to load dashboard";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stable arrays (no eslint exhaustive-deps noise)
  const employeeStats = useMemo(() => summary?.employeeStats ?? [], [summary]);
  const openSessions = useMemo(() => summary?.openSessions ?? [], [summary]);
  const pendingLeave = useMemo(() => summary?.pendingLeave ?? [], [summary]);
  const recentActivity = useMemo(() => summary?.recentActivity ?? [], [summary]);

  // employee lookup
  const employeeMap = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(Number(e.id), e);
    return m;
  }, [employees]);

  const top = useMemo(() => {
    const totalEmployees =
      typeof summary?.totalEmployees === "number" ? summary.totalEmployees : employees.length;

    const openCount = openSessions.length;
    const pendingLeaveCount = pendingLeave.length;

    return { totalEmployees, openCount, pendingLeaveCount };
  }, [summary, employees, openSessions, pendingLeave]);

  // optional: quick search inside stats table
  const [q, setQ] = useState("");
  const filteredStats = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return employeeStats;
    return employeeStats.filter((r) => {
      const id = String(r.employeeId ?? r.id ?? "");
      const emp = employeeMap.get(Number(r.employeeId));
      const name = String(r.name || emp?.name || "").toLowerCase();
      const dept = String(r.department || emp?.department || "").toLowerCase();
      return id.includes(s) || name.includes(s) || dept.includes(s);
    });
  }, [q, employeeStats, employeeMap]);

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
            <div className="we-admin-sub">Activities • hours • leave • sessions</div>
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
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy} />
            </label>

            <label className="we-admin-filterLabel">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} />
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

        {/* employee stats */}
        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Employee stats</div>
              <div className="we-admin-sectionMeta">{filteredStats.length} employees in range</div>
            </div>

            <div className="we-admin-search">
              <span className="we-admin-searchIcon" aria-hidden="true">🔎</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name / dept / id"
                disabled={busy}
              />
            </div>
          </div>

          {filteredStats.length === 0 ? (
            <div className="we-admin-empty">No stats returned for this range.</div>
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
                    const empId = Number(r.employeeId ?? r.id);
                    const emp = employeeMap.get(empId);

                    const name = r.name || emp?.name || `#${empId}`;
                    const dept = r.department || emp?.department || "—";

                    return (
                      <tr key={empId}>
                        <td>
                          <div className="we-admin-emp">
                            <div className="we-admin-empName">{name}</div>
                            <div className="we-admin-empId">ID: {empId}</div>
                          </div>
                        </td>
                        <td>{dept}</td>
                        <td>{r.daysWorked ?? r.days ?? "—"}</td>
                        <td>{fmtHours(r.totalHours ?? r.hours)}</td>
                        <td>{fmtHours(r.overtimeHours ?? r.otHours)}</td>
                        <td>{r.sundayDays ?? r.sundays ?? "—"}</td>
                        <td>{r.publicHolidayDays ?? r.holidayDays ?? "—"}</td>
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
            <div className="we-admin-empty">No one is currently checked in.</div>
          ) : (
            <div className="we-admin-list">
              {openSessions.map((s) => {
                const empId = Number(s.employeeId);
                const emp = employeeMap.get(empId);

                const name = s.employeeName || s.name || emp?.name || `Employee #${empId}`;

                return (
                  <div key={s.id ?? `${empId}:${s.checkInAt || ""}`} className="we-admin-row">
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

                const name = l.employeeName || l.name || emp?.name || `Employee #${empId}`;
                const typeCode = l.leaveTypeCode || l.code || "—";
                const typeName = l.leaveTypeName || l.typeName || "";

                return (
                  <div key={l.id ?? `${empId}:${l.startDate || ""}`} className="we-admin-row">
                    <div className="we-admin-rowTop">
                      <div className="we-admin-name">{name}</div>
                      <span className="we-admin-pill off">PENDING</span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>Type:</b> {typeCode} {typeName ? `(${typeName})` : ""}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>From:</b> {fmtDateOnly(l.startDate || l.fromDate)} <b>To:</b>{" "}
                        {fmtDateOnly(l.endDate || l.toDate)}
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

        {/* recent activity */}
        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div className="we-admin-sectionTitle">Recent activity</div>
            <div className="we-admin-sectionMeta">{recentActivity.length}</div>
          </div>

          {recentActivity.length === 0 ? (
            <div className="we-admin-empty">No activity returned.</div>
          ) : (
            <div className="we-admin-list">
              {recentActivity.map((a) => {
                const empId = Number(a.employeeId);
                const emp = employeeMap.get(empId);
                const name = a.employeeName || a.name || emp?.name || `Employee #${empId}`;

                return (
                  <div key={a.id ?? `${empId}:${a.checkInAt || ""}`} className="we-admin-row">
                    <div className="we-admin-rowTop">
                      <div className="we-admin-name">
                        {name} <span className="we-admin-id">#{a.id}</span>
                      </div>
                      <span className="we-admin-pill">LOG</span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>In:</b> {fmtDateTime(a.checkInAt)}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>Out:</b> {fmtDateTime(a.checkOutAt)}
                      </span>
                    </div>

                    {a.note ? (
                      <div className="we-admin-meta">
                        <b>Note:</b> {a.note}
                      </div>
                    ) : null}

                    {(a.checkInLat != null && a.checkInLng != null) ||
                    (a.checkOutLat != null && a.checkOutLng != null) ? (
                      <div className="we-admin-meta2">
                        <span>
                          <b>In Loc:</b> {fmtLatLng(a.checkInLat, a.checkInLng)}
                        </span>
                        <span className="we-admin-dot">•</span>
                        <span>
                          <b>Out Loc:</b> {fmtLatLng(a.checkOutLat, a.checkOutLng)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <style>{css}</style>
    </div>
  );
}
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

/* lists */
.we-admin-list{ display:grid; gap:10px; }
.we-admin-row{
  padding:12px;
  border-radius:16px;
  background: rgba(15,23,42,.22);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  display:grid;
  gap:8px;
}
.we-admin-rowTop{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:10px;
}
.we-admin-name{
  font-weight:950;
  color:#fff;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.we-admin-id{ opacity:.7; font-weight:900; margin-left: 6px; }
.we-admin-meta{ font-size:12px; opacity:.85; }
.we-admin-meta2{
  font-size:12px;
  opacity:.85;
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.we-admin-dot{ opacity:.5; }

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

@media (max-width: 860px){
  .we-admin-grid{ grid-template-columns: 1fr; }
  .we-admin-title{ font-size:24px; }
}
`;