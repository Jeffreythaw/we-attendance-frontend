import React, { useMemo, useState } from "react";

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
                  const when = pickWhen(r);

                  const mapLink = (mapUrlFn ? mapUrlFn(r) : null) || safeMapUrl(r);

                  return (
                    <div key={rowKey(r, g.day, idx)} className="we-raItem">
                      <div className="we-raTop">
                        <div className="we-raLeft">
                          <div className="we-raNameRow">
                            <div className="we-raName" title={name}>
                              {name} <span className="we-raId">#{empId}</span>
                            </div>
                            {t ? <span className="we-raType">{t}</span> : null}
                          </div>

                          <div className="we-raMeta">
                            <span className="we-raDept">{department}</span>
                            <span className="we-raDot">•</span>
                            <span className="we-raWhen">
                              {fmtDateTime ? fmtDateTime(when) : String(when || "—")}
                            </span>
                            {r?.locationName ? (
                              <>
                                <span className="we-raDot">•</span>
                                <span className="we-raLoc">{r.locationName}</span>
                              </>
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