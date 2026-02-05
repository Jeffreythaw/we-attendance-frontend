import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** local YYYY-MM-DD (not UTC) */
function localIsoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateKey(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return localIsoDate(d);
}

function eachDayInclusive(from, to) {
  const out = [];
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return out;

  const dir = a <= b ? 1 : -1;
  const d = new Date(a);

  while (true) {
    out.push(localIsoDate(d));
    if (localIsoDate(d) === localIsoDate(b)) break;
    d.setDate(d.getDate() + dir);
    if (out.length > 92) break;
  }
  return dir === 1 ? out : out.reverse();
}

function fmtTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseHM(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function timeToMinutesOfDay(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function minutesBetween(a, b) {
  if (!a || !b) return 0;
  const A = new Date(a).getTime();
  const B = new Date(b).getTime();
  if (!Number.isFinite(A) || !Number.isFinite(B) || B <= A) return 0;
  return Math.round((B - A) / 60000);
}

function pickInAt(row) {
  return (
    row?.checkInAt ??
    row?.inAt ??
    row?.clockInAt ??
    row?.startAt ??
    row?.timeIn ??
    null
  );
}
function pickOutAt(row) {
  return (
    row?.checkOutAt ??
    row?.outAt ??
    row?.clockOutAt ??
    row?.endAt ??
    row?.timeOut ??
    null
  );
}
function pickEmpId(row) {
  return Number(
    row?.employeeId ?? row?.empId ?? row?.staffId ?? row?.userId ?? NaN
  );
}
function pickWhen(row) {
  return (
    row?.checkInAt ??
    row?.checkOutAt ??
    row?.createdAt ??
    row?.timestamp ??
    row?.time ??
    row?.date ??
    row?.workDate ??
    null
  );
}

function pickLocationName(row) {
  return row?.locationName ?? row?.location ?? row?.siteName ?? row?.site ?? "";
}

function pickLatLng(row) {
  const lat = row?.lat ?? row?.latitude ?? row?.checkInLat ?? row?.checkOutLat;
  const lng = row?.lng ?? row?.longitude ?? row?.checkInLng ?? row?.checkOutLng;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
}

function timeAgo(value) {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function mapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function pickEmpName(row, employeeMap) {
  const id = pickEmpId(row);
  const emp = employeeMap?.get?.(id);
  return (
    row?.employeeName ??
    row?.staffName ??
    row?.name ??
    emp?.name ??
    (Number.isFinite(id) ? `Employee #${id}` : "Unknown")
  );
}

function shortDayLabel(iso) {
  if (!iso) return "—";
  const parts = iso.split("-");
  return `${parts[1]}/${parts[2]}`;
}

function dayLabel(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function monthDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function workedMinutes(inAt, outAt, lunchBreakMinutes, lunchThresholdMinutes) {
  const total = minutesBetween(inAt, outAt);
  if (total <= 0) return 0;
  const deduct = total >= lunchThresholdMinutes ? lunchBreakMinutes : 0;
  return Math.max(0, total - deduct);
}

function Sparkline({ values = [], max = 1 }) {
  const w = 92;
  const h = 22;
  const pad = 2;
  const n = values.length;
  if (!n) return <div className="we-sparkEmpty">—</div>;

  const denom = Math.max(1, max);
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, n - 1);
    const y = h - pad - (clamp(v, 0, denom) / denom) * (h - pad * 2);
    return [x, y];
  });

  const d = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg
      className="we-spark"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
    >
      <polyline className="we-sparkLine" points={d} fill="none" />
      <polyline
        className="we-sparkGlow"
        points={d}
        fill="none"
        aria-hidden="true"
      />
    </svg>
  );
}

export default function EmployeeInOutMatrix({
  from,
  to,
  recentActivity = [],
  employeeMap,
  employees = [],
  problemsOnly = false,
  defaultSelectedCount = 5,
  workDayMinutes = 8 * 60,
  lunchBreakMinutes = 60,
  lunchThresholdMinutes = 6 * 60,
  expectedIn = "08:00",
  expectedOut = "17:00",
  lateAfterMinutes = 15,
  earlyBeforeMinutes = 0,
}) {
  const days = useMemo(() => eachDayInclusive(from, to), [from, to]);

  const expectedInMin = useMemo(
    () => parseHM(expectedIn) ?? 8 * 60,
    [expectedIn]
  );
  const expectedOutMin = useMemo(
    () => parseHM(expectedOut) ?? 17 * 60,
    [expectedOut]
  );

  const { employeesList, byEmpDay, trendByEmp } = useMemo(() => {
    const rows = Array.isArray(recentActivity) ? recentActivity : [];
    const map = new Map();

    for (const r of rows) {
      const empId = pickEmpId(r);
      if (!Number.isFinite(empId)) continue;

      const inAt = pickInAt(r);
      const outAt = pickOutAt(r);
      const dayKey = toDateKey(
        r?.date ?? r?.day ?? r?.workDate ?? inAt ?? outAt
      );
      if (!dayKey) continue;

      if (days.length && (dayKey < days[0] || dayKey > days[days.length - 1]))
        continue;

      const name = pickEmpName(r, employeeMap);
      const k = `${empId}|${dayKey}`;
      const cur = map.get(k) || {
        empId,
        dayKey,
        name,
        inAt: null,
        outAt: null,
        lastEventAt: null,
        row: null,
      };

      const when = pickWhen(r);

      if (inAt) {
        if (!cur.inAt) cur.inAt = inAt;
        else if (new Date(inAt) < new Date(cur.inAt)) cur.inAt = inAt;
      }
      if (outAt) {
        if (!cur.outAt) cur.outAt = outAt;
        else if (new Date(outAt) > new Date(cur.outAt)) cur.outAt = outAt;
      }

      if (when) {
        const t = new Date(when).getTime();
        if (Number.isFinite(t) && (!cur.lastEventAt || t > cur.lastEventAt)) {
          cur.lastEventAt = t;
          cur.row = r;
        }
      }
      map.set(k, cur);
    }

    let baseEmployees = [];
    if (Array.isArray(employees) && employees.length) {
      baseEmployees = employees
        .map((e) => ({
          empId: Number(e.id),
          name: e?.name || `Employee #${e?.id}`,
        }))
        .filter((x) => Number.isFinite(x.empId));
    } else {
      const set = new Map();
      for (const cell of map.values()) set.set(cell.empId, cell.name);
      baseEmployees = Array.from(set.entries()).map(([empId, name]) => ({
        empId,
        name,
      }));
    }

    baseEmployees.sort((a, b) => a.name.localeCompare(b.name));

    const trend = new Map();
    for (const emp of baseEmployees) {
      const arr = days.map((day) => {
        const c = map.get(`${emp.empId}|${day}`);
        if (!c) return 0;
        return workedMinutes(
          c.inAt,
          c.outAt,
          lunchBreakMinutes,
          lunchThresholdMinutes
        );
      });
      trend.set(emp.empId, arr);
    }

    return { employeesList: baseEmployees, byEmpDay: map, trendByEmp: trend };
  }, [
    recentActivity,
    employeeMap,
    days,
    employees,
    lunchBreakMinutes,
    lunchThresholdMinutes,
  ]);

  const ddBtnRef = useRef(null); // ✅ FIX: define it

  const [ddOpen, setDdOpen] = useState(false);
  const [ddQ, setDdQ] = useState("");
  const [selected, setSelected] = useState(() => {
    const first = employeesList.slice(0, Math.max(1, defaultSelectedCount));
    return new Set(first.map((e) => e.empId));
  });

  useEffect(() => {
    setSelected((prev) => {
      if (prev && prev.size) return prev;
      const first = employeesList.slice(0, Math.max(1, defaultSelectedCount));
      return new Set(first.map((e) => e.empId));
    });
  }, [employeesList, defaultSelectedCount]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setDdOpen(false);
    }
    if (ddOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ddOpen]);

  useEffect(() => {
    if (!ddOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ddOpen]);

  const filteredEmployeesForPicker = useMemo(() => {
    const q = ddQ.trim().toLowerCase();
    if (!q) return employeesList;
    return employeesList.filter((e) =>
      `${e.name} ${e.empId}`.toLowerCase().includes(q)
    );
  }, [employeesList, ddQ]);

  const selectedEmployees = useMemo(
    () => employeesList.filter((e) => selected.has(e.empId)),
    [employeesList, selected]
  );

  const visibleEmployees = useMemo(() => {
    if (!problemsOnly) return selectedEmployees;
    return selectedEmployees.filter((emp) => {
      const latest = latestCellForEmp(emp.empId, days, byEmpDay);
      if (!latest) return false;
      const inAt = latest?.inAt || null;
      const outAt = latest?.outAt || null;
      const badges = cellBadges(inAt, outAt);
      return badges.length > 0;
    });
  }, [problemsOnly, selectedEmployees, days, byEmpDay]);
  const selectedCount = selectedEmployees.length;

  const rangeLabel = useMemo(() => {
    if (!days.length) return `${from} → ${to}`;
    return `${days[0]} → ${days[days.length - 1]}`;
  }, [days, from, to]);

  function pctForCell(inAt, outAt) {
    const mins = workedMinutes(
      inAt,
      outAt,
      lunchBreakMinutes,
      lunchThresholdMinutes
    );
    if (!mins) return 0;
    return clamp(Math.round((mins / workDayMinutes) * 100), 0, 100);
  }

  function latestCellForEmp(empId, days, byEmpDay) {
  if (!days || !days.length) return null;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const k = `${empId}|${days[i]}`;
    const cell = byEmpDay.get(k);
    if (cell && (cell.inAt || cell.outAt)) return cell;
  }
  return null;
}

function hoursLabel(inAt, outAt) {
    const mins = workedMinutes(
      inAt,
      outAt,
      lunchBreakMinutes,
      lunchThresholdMinutes
    );
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function badgeKeyList(badges) {
  return (badges || []).map((b) => b.label);
}

function cellBadges(inAt, outAt) {
    const badges = [];
    if (inAt && !outAt)
      badges.push({ key: "missingout", label: "MISSING OUT", tone: "warn" });
    if (!inAt && outAt)
      badges.push({ key: "missingin", label: "MISSING IN", tone: "warn" });

    const inMin = timeToMinutesOfDay(inAt);
    const outMin = timeToMinutesOfDay(outAt);

    if (inMin != null && inMin > expectedInMin + lateAfterMinutes)
      badges.push({ key: "late", label: "LATE", tone: "bad" });
    if (outMin != null && outMin < expectedOutMin - earlyBeforeMinutes)
      badges.push({ key: "early", label: "EARLY", tone: "bad" });

    return badges;
  }

  return (
    <div className="we-glass-card we-matrixCard">
      <div className="we-matrixHead">
        <div className="we-matrixTitle">
          Employee clock-in / clock-out
          <div className="we-matrixSub">
            Range: <b>{rangeLabel}</b> • Total: <b>{employeesList.length}</b> •
            Selected: <b>{selectedCount || 0}</b>
          </div>
        </div>

        <div className="we-matrixHeadRight">
          <button
            ref={ddBtnRef}
            className="we-ddBtn"
            type="button"
            onClick={() => setDdOpen(true)}
          >
            <span className="we-ddLabel">Employees</span>
            <span className="we-ddValue">
              {selectedCount ? `${selectedCount} selected` : "none"}
            </span>
            <span className="we-ddCaret">▾</span>
          </button>

          <div className="we-matrixLegend">
            <span className="we-mxLegend">
              <span className="we-mxDot in" /> IN
            </span>
            <span className="we-mxLegend">
              <span className="we-mxDot out" /> OUT
            </span>
            <span className="we-mxLegend">
              <span className="we-mxDot hrs" /> Hours %
            </span>
          </div>
        </div>
      </div>

      {visibleEmployees.length === 0 ? (
        <div className="we-admin-empty">Select at least 1 employee.</div>
      ) : (
        <>
          <div className="we-presenceGrid">
            {visibleEmployees.map((emp) => {
              const trend = trendByEmp.get(emp.empId) || [];
              const latest = latestCellForEmp(emp.empId, days, byEmpDay);
              const inAt = latest?.inAt || null;
              const outAt = latest?.outAt || null;
              const latestRow = latest?.row || null;
              const latestDay = latest?.dayKey || null;
              const locName = latestRow ? pickLocationName(latestRow) : "";
              const latLng = latestRow ? pickLatLng(latestRow) : null;
              const latestTime = latestRow ? timeAgo(pickWhen(latestRow)) : "";
              const badges = cellBadges(inAt, outAt);
              const state = badges.some((b) => b.tone === "bad")
                ? "bad"
                : badges.some((b) => b.tone === "warn")
                ? "warn"
                : inAt || outAt
                ? "ok"
                : "empty";

              return (
                <div key={emp.empId} className={`we-presenceCard ${state}`}>
                  <div className="we-presenceTop">
                    <div>
                      <div className="we-presenceNameRow">
                        <div className="we-presenceName" title={emp.name}>{emp.name}</div>
                        <div className="we-presenceChips">
                          {badgeKeyList(badges).slice(0, 2).map((b) => (
                            <span key={b} className="we-presenceChip">{b}</span>
                          ))}
                          {badgeKeyList(badges).length > 2 ? (
                            <span className="we-presenceChip dim">+{badgeKeyList(badges).length - 2}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="we-presenceMeta">#{emp.empId}</div>
                    </div>
                    <div className={`we-presenceStatus ${state}`}>
                      {state === "ok" ? "IN" : state === "warn" ? "CHECK" : state === "bad" ? "ALERT" : "—"}
                    </div>
                  </div>

                  <div className="we-presenceSub">
                    <span className="we-presenceDay">{dayLabel(latestDay)}</span>
                    {latestTime ? <span className="we-presenceAgo">• {latestTime}</span> : null}
                    {locName ? <span className="we-presenceLoc">• {locName}</span> : null}
                  </div>

                  <div className="we-presenceTimes">
                    <div className="we-presenceTime">
                      <span className="dot in" />
                      <span>IN</span>
                      <b>{fmtTime(inAt)}</b>
                    </div>
                    <div className="we-presenceTime">
                      <span className="dot out" />
                      <span>OUT</span>
                      <b>{fmtTime(outAt)}</b>
                    </div>
                  </div>

                  {badges.length ? (
                    <div className="we-presenceBadges">
                      {badges.slice(0, 3).map((b) => (
                        <span key={b.key} className={`we-mxBadge ${b.tone}`}>{b.label}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="we-presenceBadges empty">No flags</div>
                  )}

                  <div className="we-presenceTrend">
                    <Sparkline values={trend} max={workDayMinutes} />
                    <div className="we-presenceTrendMeta">
                      <span className="we-sparkChip">{expectedIn}–{expectedOut}</span>
                      <span className="we-sparkChip subtle">- {lunchBreakMinutes}m lunch</span>
                    </div>
                  </div>

                  <div className="we-presenceFoot">
                    <div className="we-presenceHours">Worked: <b>{hoursLabel(inAt, outAt)}</b></div>
                    <div className="we-presenceActions">
                      {latLng ? (
                        <a className="we-btn-mini" href={mapUrl(latLng.lat, latLng.lng)} target="_blank" rel="noreferrer">
                          Map
                        </a>
                      ) : (
                        <button className="we-btn-mini" type="button" disabled>Map</button>
                      )}
                      {typeof onEdit === "function" && latestRow ? (
                        <button className="we-btn-mini primary" type="button" onClick={() => onEdit(latestRow)}>
                          Edit
                        </button>
                      ) : null}
                    </div>
                    <div className="we-presencePct">{pctForCell(inAt, outAt) || 0}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="we-matrixFootNote">
            * Workday = <b>{Math.round(workDayMinutes / 60)}h</b>, lunch ={" "}
            <b>{lunchBreakMinutes}m</b> (deducted when shift ≥{" "}
            <b>{Math.round(lunchThresholdMinutes / 60)}h</b>). Late after{" "}
            <b>{lateAfterMinutes}m</b>. Early before{" "}
            <b>{earlyBeforeMinutes}m</b>.
          </div>
        </>
      )}

      {/* ✅ OVERLAY DROPDOWN */}
      {ddOpen
        ? createPortal(
            <div
              className="we-ddOverlay"
              role="dialog"
              aria-modal="true"
              onMouseDown={() => setDdOpen(false)}
            >
              <div
                className="we-ddPanelFixed"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="we-ddTop">
                  <div className="we-ddSearch">
                    <span className="we-ddSearchIcon">🔎</span>
                    <input
                      value={ddQ}
                      onChange={(e) => setDdQ(e.target.value)}
                      placeholder="Search name / id…"
                    />
                  </div>

                  <div className="we-ddActions">
                    <button
                      className="we-ddAct primary"
                      type="button"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const e of filteredEmployeesForPicker)
                            next.add(e.empId);
                          return next;
                        })
                      }
                    >
                      Select all (filtered)
                    </button>

                    <button
                      className="we-ddAct"
                      type="button"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="we-ddList">
                  {filteredEmployeesForPicker.length === 0 ? (
                    <div className="we-ddEmpty">No employees.</div>
                  ) : (
                    filteredEmployeesForPicker.map((e) => {
                      const checked = selected.has(e.empId);
                      return (
                        <label key={e.empId} className="we-ddRow">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.empId)) next.delete(e.empId);
                                else next.add(e.empId);
                                return next;
                              })
                            }
                          />
                          <span className="we-ddName">{e.name}</span>
                          <span className="we-ddId">#{e.empId}</span>
                          <span className={`we-ddChip ${checked ? "" : "dim"}`}>
                            {checked ? "ON" : "OFF"}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="we-ddFoot">
                  <button
                    className="we-ddAct"
                    type="button"
                    onClick={() => setDdOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="we-ddAct primary"
                    type="button"
                    onClick={() => setDdOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
