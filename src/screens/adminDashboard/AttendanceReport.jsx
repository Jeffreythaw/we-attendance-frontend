import React, { useEffect, useMemo, useState } from "react";
import { apiFetchText } from "../../api/client";
import { REPORT_ENDPOINT } from "./constants";
import { attendanceApi } from "../../api/attendance";
import { parseCsvText } from "./csv";

/**
 * UI table columns (ONLY for display on screen)
 * Exports (Excel/PDF) include ALL columns from CSV automatically.
 */
function formatOtHours(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const minutes = Math.max(0, Math.round(n * 60));
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

const OT_COLUMNS = new Set(["Normal day OT", "Sunday OT", "Public Holiday OT", "Total OT"]);

const DISPLAY_COLUMNS = [
  { label: "No.", key: "No." },
  { label: "Name", key: "Staff Name" },
  { label: "NW days", key: "Normal Working days" },
  { label: "WS day", key: "Working Sunday" },
  { label: "PH in range", key: "Public Holiday" },
  { label: "TTLW hour", key: "Total Working hour" },
  { label: "Act W", key: "Actual Worked Hours" },
  { label: "N OT", key: "Normal day OT" },
  { label: "S OT", key: "Sunday OT" },
  { label: "PH OT", key: "Public Holiday OT" },
  { label: "TTL OT", key: "Total OT" },
  { label: "Leave", key: "Total Leave" },
];

function parseIsoDateInput(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function yearsBetween(fromIso, toIso) {
  const a = parseIsoDateInput(fromIso);
  const b = parseIsoDateInput(toIso);
  if (!a || !b) return [];
  const out = [];
  for (let y = a.y; y <= b.y; y += 1) out.push(y);
  return out;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default function AttendanceReport({ from, to, disabled, onAuthError }) {
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [reportRows, setReportRows] = useState([]);
  const [reportHeaders, setReportHeaders] = useState([]);
  const [reportOpen, setReportOpen] = useState(true);
  const [phInRange, setPhInRange] = useState(null);

  const [reportSearch, setReportSearch] = useState("");
  const [reportOnlyMissing, setReportOnlyMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPh() {
      try {
        if (!from || !to) { setPhInRange(null); return; }
        const years = yearsBetween(from, to);
        const sets = await Promise.all(years.map((y) => attendanceApi.holidays(y).catch(() => [])));
        let count = 0;
        for (const list of sets) {
          for (const h of Array.isArray(list) ? list : []) {
            const iso = String(h?.date ?? h?.Date ?? "").slice(0, 10);
            if (!iso) continue;
            if (iso >= from && iso <= to) count += 1;
          }
        }
        if (!cancelled) setPhInRange(count);
      } catch {
        if (!cancelled) setPhInRange(null);
      }
    }
    loadPh();
    return () => { cancelled = true; };
  }, [from, to]);

  async function loadReport() {
    setReportErr("");
    setReportBusy(true);

    try {
      if (!from || !to) throw new Error("Please select From and To dates.");

      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);

      const text = await apiFetchText(`${REPORT_ENDPOINT}?${qs.toString()}`, {
        method: "GET",
        auth: true,
      });

      const parsed = parseCsvText(text);
      setReportRows(parsed.rows || []);
      setReportHeaders(parsed.headers || []);
    } catch (e) {
      const status = Number(e?.status);
      if (status === 401 || status === 403) {
        onAuthError?.();
      }
      setReportErr(e?.message || "Failed to load report");
    } finally {
      setReportBusy(false);
    }
  }

  const filteredReportRows = useMemo(() => {
    const s = reportSearch.trim().toLowerCase();
    let rows = Array.isArray(reportRows) ? reportRows : [];

    if (s) {
      rows = rows.filter((r) => {
        const name = String(r["Staff Name"] || "").toLowerCase();
        const fin = String(r["Fin No."] || "").toLowerCase();
        const no = String(r["No."] || "").toLowerCase();
        return name.includes(s) || fin.includes(s) || no.includes(s);
      });
    }

    if (reportOnlyMissing) {
      rows = rows.filter((r) => Number(r["Missing Checkout"] || 0) > 0);
    }

    return rows;
  }, [reportRows, reportSearch, reportOnlyMissing]);

  const totalRows = Array.isArray(reportRows) ? reportRows.length : 0;
  async function downloadExcel() {
    try {
      setReportErr("");

      if (!reportRows?.length) {
        await loadReport();
      }

      const headers = reportHeaders?.length
        ? reportHeaders
        : Object.keys(reportRows?.[0] || {});
      if (!headers.length) throw new Error("No data to export.");

      const rowsToExport = filteredReportRows;

      const ExcelJS = (await import("exceljs")).default;

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Attendance", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      ws.addTable({
        name: "AttendanceTable",
        ref: "A1",
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium9",
          showRowStripes: true,
        },
        columns: headers.map((h) => ({ name: h, filterButton: true })),
        rows: rowsToExport.map((r) => headers.map((h) => r?.[h] ?? "")),
      });

      headers.forEach((h, i) => {
        const maxLen = Math.max(
          String(h).length,
          ...rowsToExport.slice(0, 200).map((r) => String(r?.[h] ?? "").length)
        );
        ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 45);
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      downloadBlob(blob, `WE_Attendance_${from}_to_${to}.xlsx`);
    } catch (e) {
      setReportErr(e?.message || "Failed to download Excel");
    }
  }

  async function downloadPdf() {
    try {
      setReportErr("");

      if (!reportRows?.length) {
        await loadReport();
      }

      const headers = reportHeaders?.length
        ? reportHeaders
        : Object.keys(reportRows?.[0] || {});
      if (!headers.length) throw new Error("No data to export.");

      const rowsToExport = filteredReportRows;

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      doc.setFontSize(10);
      doc.text(`WE Attendance Report (${from} → ${to})`, 40, 30);

      autoTable(doc, {
        startY: 45,
        head: [headers],
        body: rowsToExport.map((r) => headers.map((h) => String(r?.[h] ?? ""))),
        theme: "striped",
        styles: {
          fontSize: 7,
          cellPadding: 3,
          overflow: "linebreak",
        },
        headStyles: { fontStyle: "bold" },
        margin: { left: 20, right: 20 },
      });

      doc.save(`WE_Attendance_${from}_to_${to}.pdf`);
    } catch (e) {
      setReportErr(e?.message || "Failed to download PDF");
    }
  }

  const uiRowsCount = filteredReportRows.length;

  return (
    <div className="we-glass-card we-reportCard">
      <div className="we-reportActions">
        {/* Title + meta */}
        <div className="we-reportTopRow">
          <div>
            <div className="we-admin-sectionTitle">
              Employee status (Attendance Report)
            </div>
            <div className="we-admin-sectionMeta">
              {totalRows > 0 ? `${uiRowsCount}/${totalRows} rows` : "0 rows"} • source: ReportsController
            </div>
          </div>

          <div className="we-reportBtns">
            <button className="we-btn-soft we-report-toggle" type="button" onClick={() => setReportOpen((v) => !v)} disabled={reportBusy}>
              {reportOpen ? "Hide" : "Show"}
            </button>
            <button
              className="we-btn"
              type="button"
              onClick={loadReport}
              disabled={reportBusy || disabled}
            >
              {reportBusy ? "Loading…" : "Load Report"}
            </button>

            <button
              className="we-btn"
              type="button"
              onClick={downloadExcel}
              disabled={reportBusy || disabled || uiRowsCount === 0}
            >
              Download Excel
            </button>

            <button
              className="we-btn-soft"
              type="button"
              onClick={downloadPdf}
              disabled={reportBusy || disabled || uiRowsCount === 0}
            >
              Download PDF
            </button>
          </div>
        </div>

        {/* Search + checkbox row (only when report has rows) */}
        {totalRows > 0 ? (
          <div className="we-reportSearchRow">
            <label className="we-reportCheck">
              <input
                type="checkbox"
                checked={reportOnlyMissing}
                onChange={(e) => setReportOnlyMissing(e.target.checked)}
                disabled={reportBusy || disabled}
              />
              Only missing checkout
            </label>

            <div className="we-reportSearch">
              <span className="we-admin-searchIcon" aria-hidden="true">
                🔎
              </span>
              <input
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Search staff / FIN / No."
                disabled={reportBusy || disabled}
              />
            </div>
          </div>
        ) : null}
      </div>

      {reportErr ? <div className="we-error">{reportErr}</div> : null}

      {reportOpen ? (
        <>
          {totalRows === 0 ? (
            <div className="we-reportEmpty">
              <div className="we-reportEmptyTitle">No report loaded</div>
              <div className="we-reportEmptySub">Select a range and use the top Load Report button.</div>
            </div>
          ) : uiRowsCount === 0 ? (
            <div className="we-reportEmpty">
              <div className="we-reportEmptyTitle">No matches</div>
              <div className="we-reportEmptySub">Try clearing search or disable “Only missing checkout”.</div>
            </div>
          ) : (
            <div className="we-admin-tableWrap">
              <table className="we-admin-table">
                <thead>
                  <tr>
                    {DISPLAY_COLUMNS.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReportRows.map((r, idx) => (
                    <tr key={`${r["No."] || idx}-${r["Staff Name"] || ""}`}>
                      {DISPLAY_COLUMNS.map((c) => (
                        <td key={c.key}>
                          {c.key === "Total OT" ? (
                            <b>{formatOtHours(r?.[c.key])}</b>
                          ) : c.key === "Public Holiday" ? (
                            (r?.[c.key] ?? "") === "" ? (phInRange ?? "—") : r?.[c.key]
                          ) : OT_COLUMNS.has(c.key) ? (
                            formatOtHours(r?.[c.key])
                          ) : (
                            r?.[c.key] ?? "—"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
</div>
  );
}
