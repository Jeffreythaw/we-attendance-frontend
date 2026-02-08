import React, { useMemo, useState } from "react";

const SG_TZ = "Asia/Singapore";

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

// ✅ Day . Month . Date . Year  (Thursday . January . 29 . 2026)
function formatDayLabel(dayKey) {
  if (!dayKey || dayKey === "—") return "—";

  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dayKey);

  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d);
  const month = new Intl.DateTimeFormat(undefined, { month: "long" }).format(d);
  const day = new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(d);
  const year = new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(d);

  return `${weekday} . ${month} . ${day} . ${year}`;
}

function dayToTime(dayKey) {
  if (!dayKey || dayKey === "—") return -Infinity;
  const d = new Date(`${dayKey}T00:00:00`);
  return Number.isNaN(d.getTime()) ? -Infinity : d.getTime();
}

function pickEmpId(row) {
  return Number(row?.employeeId ?? row?.empId ?? row?.staffId ?? row?.userId ?? NaN);
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

function pickDept(row, employeeMap) {
  const id = pickEmpId(row);
  const emp = employeeMap?.get?.(id);
  return row?.department ?? emp?.department ?? "—";
}

function pickType(row) {
  return String(row?.type ?? row?.eventType ?? row?.action ?? "").toUpperCase();
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

function pickInAt(row) {
  return row?.checkInAt ?? row?.inAt ?? row?.clockInAt ?? row?.startAt ?? row?.timeIn ?? null;
}

function pickOutAt(row) {
  return row?.checkOutAt ?? row?.outAt ?? row?.clockOutAt ?? row?.endAt ?? row?.timeOut ?? null;
}

function formatTimeOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toFiniteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sgIsoDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SG_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${day}`;
}

function sgCutoffUtcMs(iso, hour24) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const SG_OFFSET = 8;
  const whole = Math.floor(hour24);
  const mins = Math.round((hour24 - whole) * 60);
  return Date.UTC(y, m - 1, d, whole - SG_OFFSET, mins, 0, 0);
}

function roundOtDisplayMinutes(mins) {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  if (n <= 0) return 0;
  const block = 15;
  return Math.round(n / block) * block;
}

function calcOtMins(row) {
  const backend = toFiniteNumber(
    row?.otMinutes,
    row?.otMins,
    row?.overtimeMinutes,
    row?.overtimeMins,
    row?.totalOtMinutes,
    row?.ot,
  );
  if (backend != null) return Math.max(0, Math.round(backend));

  const inAt = pickInAt(row);
  const outAt = pickOutAt(row);
  const inD = inAt ? new Date(inAt) : null;
  const outD = outAt ? new Date(outAt) : null;
  const inOk = inD && !Number.isNaN(inD.getTime());
  const outOk = outD && !Number.isNaN(outD.getTime());

  const workedFromBackend = toFiniteNumber(
    row?.workedMinutes,
    row?.totalWorkedMinutes,
    row?.minutesWorked,
  );
  const regularFromBackend = toFiniteNumber(
    row?.regularMinutes,
    row?.normalMinutes,
    row?.baseMinutes,
  );
  if (workedFromBackend != null && regularFromBackend != null) {
    return Math.max(0, Math.round(workedFromBackend - regularFromBackend));
  }
  if (workedFromBackend != null && regularFromBackend == null && outOk) {
    const dayIsoFromOut = sgIsoDate(outD);
    const cutoffFromOut = sgCutoffUtcMs(dayIsoFromOut, 17.5);
    if (cutoffFromOut != null) {
      return Math.max(0, Math.round((outD.getTime() - cutoffFromOut) / 60000));
    }
  }

  if (!outOk) return 0;
  const dayIso = sgIsoDate(inOk ? inD : outD);
  const cutoffMs = sgCutoffUtcMs(dayIso, 17.5);
  if (cutoffMs == null) return 0;

  return Math.max(0, Math.round((outD.getTime() - cutoffMs) / 60000));
}

function formatOt(row) {
  const mins = roundOtDisplayMinutes(calcOtMins(row));
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function safeMapUrl(row) {
  const lat = row?.lat ?? row?.latitude;
  const lng = row?.lng ?? row?.longitude;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return null;
}

function rowKey(r, dayKey, idx) {
  const empId = pickEmpId(r);
  const when = pickWhen(r);
  const t = pickType(r);
  const id = r?.id ?? r?.logId ?? r?.attendanceLogId;
  if (id !== undefined && id !== null) return `log-${id}`;
  return `${dayKey}-${empId}-${String(when ?? "")}-${t}-${idx}`;
}

export default function RecentActivity({
  recentActivity = [],
  employees = [],
  allDepartments = [],
  employeeMap,
  busy,
  onEdit,
  onlyTodayByDefault = true,
  fmtDateTime,
  mapUrl,
}) {
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dept, setDept] = useState("");

  const todayKey = useMemo(() => localIsoDate(new Date()), []);
  const [showTodayOnly, setShowTodayOnly] = useState(!!onlyTodayByDefault);

  const mapUrlFn = typeof mapUrl === "function" ? mapUrl : null;

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const arr = Array.isArray(recentActivity) ? recentActivity : [];

    return arr.filter((r) => {
      const empId = pickEmpId(r);
      const name = pickEmpName(r, employeeMap);
      const department = pickDept(r, employeeMap);
      const dayKey = toDateKey(r?.date ?? r?.day ?? r?.workDate ?? r?.checkInAt ?? r?.checkOutAt);

      if (showTodayOnly && dayKey && dayKey !== todayKey) return false;
      if (employeeId && String(empId) !== String(employeeId)) return false;
      if (dept && String(department).trim() !== String(dept).trim()) return false;
      if (!text) return true;

      const blob = [
        empId,
        name,
        department,
        pickType(r),
        r?.note,
        r?.locationName,
        r?.date,
        r?.workDate,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(text);
    });
  }, [recentActivity, employeeMap, q, employeeId, dept, showTodayOnly, todayKey]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const dayKey =
        toDateKey(r?.date ?? r?.day ?? r?.workDate ?? r?.checkInAt ?? r?.checkOutAt) || "—";
      if (!m.has(dayKey)) m.set(dayKey, []);
      m.get(dayKey).push(r);
    }

    const keys = Array.from(m.keys()).sort((a, b) => dayToTime(b) - dayToTime(a));
    return keys.map((k) => ({ day: k, rows: m.get(k) }));
  }, [filtered]);

  return (
    <div className="we-glass-card we-raCard">
      <div className="we-admin-sectionHead">
        <div>
          <div className="we-admin-sectionTitle">Recent activity</div>
          <div className="we-admin-sectionMeta">
            {filtered.length} logs •{" "}
            {showTodayOnly ? (
              <>
                Showing <b>Today only</b> ({formatDayLabel(todayKey)})
              </>
            ) : (
              <>
                Showing <b>filtered range</b>
              </>
            )}
          </div>
        </div>

        <label className="we-toggle">
          <input
            type="checkbox"
            checked={showTodayOnly}
            onChange={(e) => setShowTodayOnly(e.target.checked)}
          />
          Today only
        </label>
      </div>

      <div className="we-raFilters">
        <label className="we-raLabel">
          Employee
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={busy}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} #{e.id}
              </option>
            ))}
          </select>
        </label>

        <label className="we-raLabel">
          Department
          <select value={dept} onChange={(e) => setDept(e.target.value)} disabled={busy}>
            <option value="">All departments</option>
            {allDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="we-raSearchWrap">
          <div className="we-raSearch">
            <span className="we-raSearchIcon">🔎</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name / note / id / date…"
              disabled={busy}
            />
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="we-admin-empty">{busy ? "Loading…" : "No activity."}</div>
      ) : (
        <div className="we-dayGroups">
          {grouped.map((g) => (
            <div className="we-dayGroup" key={g.day}>
              <div className="we-dayHeader we-dayHeaderStatic">
                <div className="we-dayHeaderLeft">
                  <div className="we-dayTitle">
                    {formatDayLabel(g.day)}
                    {g.day === todayKey ? <span className="we-dayPill">Today</span> : null}
                  </div>
                  <div className="we-daySub">{g.rows.length} logs</div>
                </div>
                <div className="we-dayCount">{g.rows.length}</div>
              </div>

              <div className="we-dayList">
                {g.rows.map((r, idx) => {
                  const empId = pickEmpId(r);
                  const name = pickEmpName(r, employeeMap);
                  const department = pickDept(r, employeeMap);
                  const t = pickType(r);
                  const inAt = pickInAt(r);
                  const outAt = pickOutAt(r);
                  const when = pickWhen(r);
                  const tone = t.includes("OUT") ? "out" : t.includes("IN") ? "in" : t.includes("EDIT") ? "edit" : "neutral";

                  const mapLink = (mapUrlFn ? mapUrlFn(r) : null) || safeMapUrl(r);

                  return (
                    <div key={rowKey(r, g.day, idx)} className={`we-raItem ${tone}`}>
                      <div className="we-raRail">
                        <span className="we-raRailDot" />
                        <span className="we-raRailLine" />
                      </div>
                      <div className="we-raContent">
                        <div className="we-raTop">
                        <div className="we-raLeft">
                          <div className="we-raNameRow">
                            <div className="we-raName" title={name}>
                              {name} <span className="we-raId">#{empId}</span>
                            </div>
                            {t ? <span className={`we-raType ${tone}`}>{t}</span> : null}
                          </div>

                          <div className="we-raMeta we-raMetaGrid">
                            <div className="we-raMetaCell">
                              <span className="we-raMetaLabel">Dept</span>
                              <span className="we-raMetaValue">{department}</span>
                            </div>
                            <div className="we-raMetaCell">
                              <span className="we-raMetaLabel">In</span>
                              <span className="we-raMetaValue">{formatTimeOnly(inAt)}</span>
                            </div>
                            <div className="we-raMetaCell">
                              <span className="we-raMetaLabel">Out</span>
                              <span className="we-raMetaValue">{formatTimeOnly(outAt)}</span>
                            </div>
                            <div className="we-raMetaCell">
                              <span className="we-raMetaLabel">OT</span>
                              <span className="we-raMetaValue">{formatOt(r)}</span>
                            </div>
                            {r?.locationName ? (
                              <div className="we-raMetaCell wide">
                                <span className="we-raMetaLabel">Location</span>
                                <span className="we-raMetaValue">{r.locationName}</span>
                              </div>
                            ) : null}
                          </div>

                          {r?.note ? <div className="we-raNote">{r.note}</div> : null}
                        </div>

                        <div className="we-raActions">
                          {mapLink ? (
                            <a className="we-btn-mini" href={mapLink} target="_blank" rel="noreferrer">
                              Map
                            </a>
                          ) : (
                            <button className="we-btn-mini" type="button" disabled>
                              Map
                            </button>
                          )}

                          {typeof onEdit === "function" ? (
                            <button className="we-btn-mini primary" type="button" onClick={() => onEdit(r)}>
                              Edit
                            </button>
                          ) : null}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
