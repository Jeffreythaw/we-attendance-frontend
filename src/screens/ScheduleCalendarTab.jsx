import React, { useEffect, useMemo, useRef, useState } from "react";
import { schedulesApi } from "../api/schedules";
import { Card } from "../components/Card";

const SG_TZ = "Asia/Singapore";
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAL_TONE_COUNT = 6;

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

function hashToneSeed(value) {
  const s = String(value || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function toneClassForEntry(entry) {
  const key = `${entry?.workLocation || ""}|${entry?.workTitle || ""}`;
  const tone = hashToneSeed(key) % CAL_TONE_COUNT;
  return `tone-${tone}`;
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
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [workerQuery, setWorkerQuery] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [workLocation, setWorkLocation] = useState("");
  const [workTitle, setWorkTitle] = useState("");
  const [note, setNote] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

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
  const workerPickerRef = useRef(null);
  const workerTriggerRef = useRef(null);

  const filteredWorkers = useMemo(() => {
    const q = workerQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.name || ""} ${e.id}`.toLowerCase().includes(q));
  }, [employees, workerQuery]);

  const selectedWorkerNames = useMemo(() => {
    const idSet = new Set(Array.from(selectedEmployeeIds).map((x) => Number(x)));
    return employees.filter((e) => idSet.has(Number(e.id))).map((e) => e.name);
  }, [employees, selectedEmployeeIds]);

  useEffect(() => {
    function onPointerDown(ev) {
      if (!workerPickerOpen) return;
      const panel = workerPickerRef.current;
      const trigger = workerTriggerRef.current;
      const target = ev.target;
      if ((panel && panel.contains(target)) || (trigger && trigger.contains(target))) return;
      setWorkerPickerOpen(false);
    }
    if (workerPickerOpen) document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [workerPickerOpen]);

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

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditingDraft({
      employeeId: entry.employeeId,
      workDate: entry.workDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      workLocation: entry.workLocation || "",
      workTitle: entry.workTitle || "",
      note: entry.note || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingDraft(null);
  }

  async function saveEdit() {
    if (!editingId || !editingDraft) return;
    if (!editingDraft.startTime || !editingDraft.endTime) {
      setErr("Start and End times are required.");
      return;
    }

    setEditBusy(true);
    setErr("");
    try {
      await schedulesApi.updateEntry(editingId, {
        employeeId: Number(editingDraft.employeeId),
        workDate: editingDraft.workDate,
        startTime: editingDraft.startTime,
        endTime: editingDraft.endTime,
        workLocation: editingDraft.workLocation,
        workTitle: editingDraft.workTitle,
        note: editingDraft.note,
      });
      cancelEdit();
      await loadEntries();
    } catch (e) {
      const msg = e?.message || "Failed to update schedule";
      if (String(msg).includes("401") || String(msg).includes("403")) return onAuthError?.();
      setErr(msg);
    } finally {
      setEditBusy(false);
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
          <button type="button" className="we-btn-soft we-btn--refresh" onClick={loadEntries} disabled={busy}>
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
            const dayChips = dayEntries.slice(0, 2);
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
                {dayChips.length > 0 ? (
                  <div className="we-cal-dayRows">
                    {dayChips.map((e) => (
                      <div key={e.id} className={`we-cal-chip ${toneClassForEntry(e)}`}>
                        {e.workLocation || e.workTitle || "Work"}
                      </div>
                    ))}
                    {dayEntries.length > dayChips.length ? (
                      <div className="we-cal-more">+{dayEntries.length - dayChips.length} more</div>
                    ) : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {err ? <div className="we-error">{err}</div> : null}
      </Card>

      <Card className="we-glass-card">
        <div className="we-cal-title">Selected Date Schedule • {selectedDay}</div>
        <div className="we-cal-sub">Role: {isAdmin ? "Admin" : isSupervisor ? "Supervisor" : "Worker"} {canEditEntries ? "• Edit allowed" : "• Read only"}</div>
        <div className="we-cal-scheduleGrid">
          {selectedEntries.length === 0 ? (
            <div className="we-clock-empty">No schedules for this day.</div>
          ) : (
            selectedByLocation.map((group, groupIdx) => (
              <div key={group.location} className={`we-cal-item we-cal-locCard tone-${groupIdx % CAL_TONE_COUNT}`}>
                <div><b>Location:</b> {group.location}</div>
                <div><b>Workers:</b> {group.workerNames.join(", ") || "-"}</div>
                <div className="we-cal-list">
                  {group.list.map((e) => (
                    <div key={e.id} className={`we-cal-item we-cal-entryCard ${toneClassForEntry(e)}`}>
                      {editingId === e.id && editingDraft ? (
                        <div className="we-cal-editWrap">
                          <div className="we-cal-editGrid">
                            <label className="we-clock-label">Date
                              <input
                                type="date"
                                value={editingDraft.workDate}
                                onChange={(ev) => setEditingDraft((d) => ({ ...d, workDate: ev.target.value }))}
                              />
                            </label>
                            <label className="we-clock-label">Start
                              <input
                                type="time"
                                value={editingDraft.startTime}
                                onChange={(ev) => setEditingDraft((d) => ({ ...d, startTime: ev.target.value }))}
                              />
                            </label>
                            <label className="we-clock-label">End
                              <input
                                type="time"
                                value={editingDraft.endTime}
                                onChange={(ev) => setEditingDraft((d) => ({ ...d, endTime: ev.target.value }))}
                              />
                            </label>
                            <label className="we-clock-label">Work Location
                              <input
                                value={editingDraft.workLocation}
                                onChange={(ev) => setEditingDraft((d) => ({ ...d, workLocation: ev.target.value }))}
                              />
                            </label>
                            <label className="we-clock-label">Work Title
                              <input
                                value={editingDraft.workTitle}
                                onChange={(ev) => setEditingDraft((d) => ({ ...d, workTitle: ev.target.value }))}
                              />
                            </label>
                            <label className="we-clock-label we-cal-span2">Note
                              <input
                                value={editingDraft.note}
                                onChange={(ev) => setEditingDraft((d) => ({ ...d, note: ev.target.value }))}
                              />
                            </label>
                          </div>
                          <div className="we-cal-rowBtns">
                            <button type="button" className="we-btn we-btn--save" onClick={saveEdit} disabled={editBusy}>
                              {editBusy ? "Saving..." : "Save"}
                            </button>
                            <button type="button" className="we-btn-soft" onClick={cancelEdit} disabled={editBusy}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div><b>{e.startTime} - {e.endTime}</b> • {e.employeeName}</div>
                          <div>{e.workTitle || "Work"}</div>
                          {e.note ? <div>Note: {e.note}</div> : null}
                          {canEditEntries ? (
                            <div className="we-cal-rowBtns">
                              <button type="button" className="we-btn-soft we-btn--edit" onClick={() => startEdit(e)}>Edit</button>
                              <button type="button" className="we-btn danger we-btn--delete" onClick={() => removeEntry(e.id)}>Delete</button>
                            </div>
                          ) : null}
                        </>
                      )}
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
                  ref={workerTriggerRef}
                  type="button"
                  className="we-btn-soft we-btn--apply we-cal-workerTrigger"
                  onClick={() => setWorkerPickerOpen((v) => !v)}
                >
                  {selectedEmployeeIds.size > 0
                    ? `${selectedEmployeeIds.size} selected`
                    : "Select workers"}
                </button>
              </div>
              {workerPickerOpen ? (
                <div className="we-cal-workerPicker" ref={workerPickerRef}>
                  <div className="we-cal-workerSearch">
                    <input
                      type="text"
                      value={workerQuery}
                      onChange={(e) => setWorkerQuery(e.target.value)}
                      placeholder="Search worker..."
                    />
                  </div>
                  <div className="we-cal-multiActions">
                    <button
                      type="button"
                      className="we-btn-soft we-btn--apply"
                      onClick={() => setSelectedEmployeeIds(new Set(filteredWorkers.map((e) => e.id)))}
                    >
                      Select filtered
                    </button>
                    <button
                      type="button"
                      className="we-btn-soft we-btn--apply"
                      onClick={() => setSelectedEmployeeIds(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="we-cal-multiList">
                    {filteredWorkers.map((emp) => {
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
                </div>
              ) : null}
              <div className="we-cal-workerSummary">
                {selectedWorkerNames.length ? selectedWorkerNames.join(", ") : "No worker selected"}
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
            <button type="submit" className="we-btn we-btn--save" disabled={saveBusy}>{saveBusy ? "Saving..." : "Save Schedule"}</button>
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
