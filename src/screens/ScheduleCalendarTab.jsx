import React, { useEffect, useMemo, useState } from "react";
import { schedulesApi } from "../api/schedules";
import { Card } from "../components/Card";

const SG_TZ = "Asia/Singapore";
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SG_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthIsoFromDate(d) {
  const y = Number(new Intl.DateTimeFormat("en-CA", { timeZone: SG_TZ, year: "numeric" }).format(d));
  const m = Number(new Intl.DateTimeFormat("en-CA", { timeZone: SG_TZ, month: "2-digit" }).format(d));
  return `${y}-${pad2(m)}`;
}

function monthRange(monthIso) {
  const [y, m] = monthIso.split("-").map(Number);
  const from = `${y}-${pad2(m)}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${pad2(m)}-${pad2(last)}`;
  return { from, to };
}

function shiftMonth(monthIso, diff) {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + diff, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function gridDays(monthIso) {
  const [y, m] = monthIso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDow = first.getUTCDay();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let i = 0; i < startDow; i += 1) out.push(null);
  for (let day = 1; day <= lastDay; day += 1) {
    const iso = `${y}-${pad2(m)}-${pad2(day)}`;
    out.push({ iso, day, inMonth: true });
  }
  while (out.length % 7 !== 0) out.push(null);
  return out;
}

export default function ScheduleCalendarTab({ user, onAuthError }) {
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const canEditEntries = isAdmin || isSupervisor;
  const canLoadEmployees = isAdmin || isSupervisor;

  const [monthIso, setMonthIso] = useState(() => monthIsoFromDate(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => todayIso());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [entries, setEntries] = useState([]);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(() => new Set());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [workLocation, setWorkLocation] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [note, setNote] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const monthLabel = useMemo(() => {
    const [y, m] = monthIso.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: SG_TZ })
      .format(new Date(Date.UTC(y, m - 1, 1)));
  }, [monthIso]);

  const monthGrid = useMemo(() => gridDays(monthIso), [monthIso]);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = String(e?.workDate || "");
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
      map.set(k, arr);
    }
    return map;
  }, [entries]);
  const selectedEntries = useMemo(() => byDay.get(selectedDay) || [], [byDay, selectedDay]);
  const selectedByLocation = useMemo(() => {
    const map = new Map();
    for (const e of selectedEntries) {
      const key = String(e?.workLocation || "").trim() || "(No location)";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return Array.from(map.entries()).map(([location, list]) => {
      const workerNames = Array.from(new Set(list.map((x) => x.employeeName).filter(Boolean)));
      return { location, workerNames, list };
    });
  }, [selectedEntries]);

  async function loadEmployees() {
    if (!canLoadEmployees) return;
    try {
      const rows = await schedulesApi.employees();
      const list = Array.isArray(rows) ? rows : [];
      setEmployees(list);
      if (selectedEmployeeIds.size === 0 && list.length) setSelectedEmployeeIds(new Set([list[0].id]));
    } catch (e) {
      const msg = e?.message || "Failed to load employees";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    }
  }

  async function loadEntries() {
    const { from, to } = monthRange(monthIso);
    setBusy(true);
    setErr("");
    try {
      const list = await schedulesApi.entries(from, to, (isAdmin || isSupervisor) ? (employeeFilter || undefined) : undefined);
      setEntries(Array.isArray(list) ? list : []);
    } catch (e) {
      const msg = e?.message || "Failed to load schedules";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isSupervisor]);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthIso, employeeFilter, isAdmin, isSupervisor]);

  async function createEntry(e) {
    e.preventDefault();
    if (!canEditEntries) return;
    const employeeIds = Array.from(selectedEmployeeIds).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (employeeIds.length === 0) return setErr("At least one worker is required.");
    if (!selectedDay) return setErr("Date is required.");
    if (!startTime || !endTime) return setErr("Start and End times are required.");

    setSaveBusy(true);
    setErr("");
    try {
      await schedulesApi.createEntriesBulk({
        employeeIds,
        workDate: selectedDay,
        startTime,
        endTime,
        workLocation,
        workTitle,
        note,
      });
      setWorkTitle("");
      setWorkLocation("");
      setNote("");
      await loadEntries();
    } catch (e2) {
      const msg = e2?.message || "Failed to save schedule";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setSaveBusy(false);
    }
  }

  async function removeEntry(id) {
    if (!canEditEntries) return;
    try {
      await schedulesApi.deleteEntry(id);
      await loadEntries();
    } catch (e) {
      const msg = e?.message || "Failed to delete schedule";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    }
  }

  return (
    <div className="we-cal-root">
      <Card className="we-glass-card">
        <div className="we-cal-head">
          <div>
            <div className="we-cal-title">Schedule Calendar</div>
            <div className="we-cal-sub">Monthly planning with multi-shift support</div>
          </div>
          <button type="button" className="we-btn-soft" onClick={loadEntries} disabled={busy}>
            {busy ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="we-cal-toolbar">
          <button type="button" className="we-cal-nav" onClick={() => setMonthIso((m) => shiftMonth(m, -1))}>‹</button>
          <div className="we-cal-monthLabel">{monthLabel}</div>
          <button type="button" className="we-cal-nav" onClick={() => setMonthIso((m) => shiftMonth(m, 1))}>›</button>
          {(isAdmin || isSupervisor) ? (
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="we-cal-filter">
              <option value="">All workers</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          ) : null}
        </div>

        <div className="we-cal-grid">
          {WEEK_DAYS.map((d) => <div key={d} className="we-cal-weekhead">{d}</div>)}
          {monthGrid.map((d, idx) => {
            if (!d) {
              return <div key={`empty-${idx}`} className="we-cal-day is-empty" aria-hidden="true" />;
            }
            const dayEntries = byDay.get(d.iso) || [];
            const selected = d.iso === selectedDay;
            return (
              <button
                type="button"
                key={d.iso}
                className={`we-cal-day ${d.inMonth ? "" : "is-dim"} ${selected ? "is-selected" : ""}`}
                onClick={() => setSelectedDay(d.iso)}
              >
                <div className="we-cal-dayTop">
                  <span>{d.day}</span>
                  {dayEntries.length > 0 ? <span className="we-cal-badge">{dayEntries.length}</span> : null}
                </div>
              </button>
            );
          })}
        </div>

        {err ? <div className="we-error">{err}</div> : null}
      </Card>

      <Card className="we-glass-card">
        <div className="we-cal-title">Selected Date Schedule • {selectedDay}</div>
        <div className="we-cal-sub">Role: {isAdmin ? "Admin" : isSupervisor ? "Supervisor" : "Worker"} {canEditEntries ? "• Edit allowed" : "• Read only"}</div>
        <div className="we-cal-list">
          {selectedEntries.length === 0 ? (
            <div className="we-clock-empty">No schedules for this day.</div>
          ) : (
            selectedByLocation.map((group) => (
              <div key={group.location} className="we-cal-item">
                <div><b>Location:</b> {group.location}</div>
                <div><b>Workers:</b> {group.workerNames.join(", ") || "-"}</div>
                <div className="we-cal-list">
                  {group.list.map((e) => (
                    <div key={e.id} className="we-cal-item">
                      <div><b>{e.startTime} - {e.endTime}</b> • {e.employeeName}</div>
                      <div>{e.workTitle || "Work"}</div>
                      {e.note ? <div>Note: {e.note}</div> : null}
                      {canEditEntries ? (
                        <div className="we-cal-rowBtns">
                          <button type="button" className="we-btn danger" onClick={() => removeEntry(e.id)}>Delete</button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {canEditEntries ? (
        <Card className="we-glass-card">
          <div className="we-cal-title">Add Schedule</div>
          <form onSubmit={createEntry} className="we-cal-form we-cal-form-grid">
            <label className="we-clock-label we-cal-span2">Worker
              <div className="we-cal-multiActions">
                <button
                  type="button"
                  className="we-btn-soft"
                  onClick={() => setSelectedEmployeeIds(new Set(employees.map((e) => e.id)))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="we-btn-soft"
                  onClick={() => setSelectedEmployeeIds(new Set())}
                >
                  Clear
                </button>
              </div>
              <div className="we-cal-multiList">
                {employees.map((emp) => {
                  const checked = selectedEmployeeIds.has(emp.id);
                  return (
                    <label key={emp.id} className="we-cal-multiItem">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedEmployeeIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(emp.id)) next.delete(emp.id);
                            else next.add(emp.id);
                            return next;
                          });
                        }}
                      />
                      <span>{emp.name}</span>
                    </label>
                  );
                })}
              </div>
            </label>
            <label className="we-clock-label">Date
              <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} required />
            </label>
            <label className="we-clock-label">Start
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>
            <label className="we-clock-label">End
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </label>
            <label className="we-clock-label">Work Location
              <input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} placeholder="e.g. Jurong Plant Room" />
            </label>
            <label className="we-clock-label">Work Title
              <input value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="e.g. FCU maintenance" />
            </label>
            <label className="we-clock-label we-cal-span2">Note
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional details" />
            </label>
            <button type="submit" className="we-btn" disabled={saveBusy}>{saveBusy ? "Saving..." : "Save Schedule"}</button>
          </form>
        </Card>
      ) : (
        <Card className="we-glass-card">
          <div className="we-cal-sub">Read-only mode. Only Admin and Supervisor can add/edit schedule entries.</div>
        </Card>
      )}
    </div>
  );
}
