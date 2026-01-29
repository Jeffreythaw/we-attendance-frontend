import { Fragment, useMemo, useState } from "react";
import "./EmployeesGrid.css";

function getField(e, field, altField = null) {
  if (e?.[field] !== undefined && e?.[field] !== null && e?.[field] !== "") return e[field];
  if (altField && e?.[altField] !== undefined && e?.[altField] !== null && e?.[altField] !== "") return e[altField];
  const snake = field.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (e?.[snake] !== undefined && e?.[snake] !== null && e?.[snake] !== "") return e[snake];
  return null;
}

export default function EmployeesGrid({ rows, loading, q, setQ, onEdit, fmtDateOnly, fmtDateTime }) {
  const [showDetails, setShowDetails] = useState(false);
  const [density, setDensity] = useState(() => {
    if (typeof window === "undefined") return "compact";
    return window.matchMedia("(min-width: 900px)").matches ? "comfort" : "compact";
  });

  const gridRows = useMemo(() => {
    return (rows || []).map((e) => ({
      raw: e,
      id: e?.id,
      name: e?.name || "(no name)",
      dept: e?.department || e?.dept || "—",
      active: !!e?.active,
      fin: getField(e, "finNo", "fin_number"),
      nat: getField(e, "nationality"),
      dob: getField(e, "dateOfBirth", "dob") || getField(e, "date_of_birth"),
      wpNo: getField(e, "workPermitNo", "work_permit_no"),
      wpExp:
        getField(e, "workPermitExpiry", "work_permit_expiry") || getField(e, "work_permit_expiry_date"),
      csocNo: getField(e, "bcssCsocNo", "bcss_csoc_no"),
      csocExp:
        getField(e, "csocExpiryDate", "csoc_expiry_date") || getField(e, "bcss_csoc_expiry_date"),
      boomExp: getField(e, "boomLiftExpiryDate", "boom_lift_expiry_date"),
      scissorExp: getField(e, "scissorLiftExpiryDate", "scissor_lift_expiry_date"),
      createdAt: e?.createdAt,
    }));
  }, [rows]);

  function handleRowClick(r, ev) {
    if (ev.target?.closest?.("button, a, input, select, textarea, label")) return;
    onEdit?.(r.raw);
  }

  const baseColCount = 6; // No, Name, ID, Dept, Status, Action

  return (
    <div className="we-admin-card">
      <div className="we-gridHead">
        <div>
          <div className="we-admin-cardTitle">Employees ({gridRows.length})</div>
          <div className="we-gridSub">Manage workforce data efficiently</div>
        </div>

        <div className="we-gridToggles">
          <button
            type="button"
            className="we-chip"
            onClick={() => setDensity((d) => (d === "compact" ? "comfort" : "compact"))}
          >
            <span className="we-chipIcon" aria-hidden="true">🎚️</span>
            <span className="we-chipText">{density === "compact" ? "Comfort" : "Compact"}</span>
          </button>

          <button
            type="button"
            className={`we-chip ${showDetails ? "on" : ""}`}
            aria-pressed={showDetails}
            onClick={() => setShowDetails((v) => !v)}
            title={showDetails ? "Hide employee details" : "Show all employee details"}
          >
            <span className="we-chipIcon" aria-hidden="true">{showDetails ? "🙈" : "🧾"}</span>

            {/* long label (desktop/tablet) */}
            <span className="we-chipText we-chipTextLong">
              {showDetails ? "Hide details" : "Show all details"}
            </span>

            {/* short label (mobile) */}
            <span className="we-chipText we-chipTextShort">
              {showDetails ? "Hide" : "Details"}
            </span>
          </button>
        </div>
      </div>

      <div className="we-admin-searchRow">
        <div className="we-input">
          <span className="we-icon" aria-hidden="true">🔎</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees..." />
        </div>
      </div>

      <div className={`we-gridWrap ${density}`} role="region" aria-label="Employees data grid">
        <table className="we-gridTable we-gridTableCompact">
          <thead>
            <tr>
              <th className="we-col-no we-sticky-l1">No.</th>
              <th className="we-col-name we-sticky-l2">Name</th>
              <th className="we-col-id">ID</th>
              <th className="we-col-dept">Dept</th>
              <th className="we-col-status">Status</th>
              <th className="we-col-actions we-sticky-r1">Action</th>
            </tr>
          </thead>

          <tbody>
            {gridRows.length === 0 ? (
              <tr>
                <td className="we-gridEmpty" colSpan={baseColCount}>
                  {loading ? "Loading…" : "No employees found."}
                </td>
              </tr>
            ) : (
              gridRows.map((r, idx) => (
                <Fragment key={r.id ?? `row-${idx}`}>
                  <tr className="we-gridRow" onClick={(ev) => handleRowClick(r, ev)}>
                    <td className="we-col-no we-sticky-l1">{idx + 1}</td>

                    <td className="we-col-name we-sticky-l2" title={r.name}>
                      <span className="we-cellEllip">{r.name}</span>
                    </td>

                    <td className="we-col-id">
                      <span className="we-cellMono">#{r.id}</span>
                    </td>

                    <td className="we-col-dept" title={r.dept}>
                      <span className="we-cellEllip">{r.dept}</span>
                    </td>

                    <td className="we-col-status">
                      <span className={`we-admin-pill ${r.active ? "ok" : "bad"}`}>
                        {r.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>

                    <td className="we-col-actions we-sticky-r1">
                      <button
                        className="we-btn-mini"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEdit?.(r.raw);
                        }}
                        disabled={loading}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>

                  {showDetails ? (
                    <tr className="we-detailsRow">
                      <td colSpan={baseColCount}>
                        <div className="we-detailsGrid">
                          <div className="we-kv"><div className="k">FIN</div><div className="v">{r.fin || "—"}</div></div>
                          <div className="we-kv"><div className="k">Nationality</div><div className="v">{r.nat || "—"}</div></div>
                          <div className="we-kv"><div className="k">DOB</div><div className="v">{fmtDateOnly(r.dob)}</div></div>

                          <div className="we-kv"><div className="k">WP No</div><div className="v">{r.wpNo || "—"}</div></div>
                          <div className="we-kv"><div className="k">WP Exp</div><div className="v">{fmtDateOnly(r.wpExp)}</div></div>

                          <div className="we-kv"><div className="k">CSOC No</div><div className="v">{r.csocNo || "—"}</div></div>
                          <div className="we-kv"><div className="k">CSOC Exp</div><div className="v">{fmtDateOnly(r.csocExp)}</div></div>

                          <div className="we-kv"><div className="k">Boom Exp</div><div className="v">{fmtDateOnly(r.boomExp)}</div></div>
                          <div className="we-kv"><div className="k">Scissor Exp</div><div className="v">{fmtDateOnly(r.scissorExp)}</div></div>

                          <div className="we-kv we-kvWide">
                            <div className="k">Created</div>
                            <div className="v">{fmtDateTime(r.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="we-gridHint">
        Tip: Table stays compact on mobile. Turn on “Details” to view permit/cert info below each employee.
      </div>
    </div>
  );
}