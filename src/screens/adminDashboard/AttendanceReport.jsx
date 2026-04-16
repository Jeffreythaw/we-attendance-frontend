import React, { useEffect, useMemo, useState } from "react";
import { apiFetchBlob, apiFetchText } from "../../api/client";
import { REPORT_ENDPOINT } from "./constants";
import { attendanceApi } from "../../api/attendance";
import { parseContentDispositionFilename, parseCsvText } from "./csv";

/**
 * UI table columns (ONLY for display on screen)
 * Exports (Excel/PDF) include ALL columns from CSV automatically.
 */
const DISPLAY_COLUMNS = [
  { label: "No.", key: "No." },
  { label: "Name", key: "Staff Name" },
  { label: "NW days", key: "Normal Working days" },
  { label: "WS day", key: "Working Sunday" },
  { label: "PH in range", key: "Public Holiday" },
  { label: "TTLW hour", key: "Total Working hour" },
  { label: "Act W", key: "Actual Worked Hours" },
  { label: "M~F OT", key: "Mon~Fri OT (1.5x)" },
  { label: "Sat OT", key: "Sat OT (1.5x)" },
  { label: "Sun/PH OT", key: "Sun/PH OT (2.0x)" },
  { label: "Overnight OT", key: "Overnight OT (2.0x)" },
  { label: "TTL OT", key: "Total OT" },
  { label: "Leave", key: "Total Leave" },
  { label: "Basic Pay", key: "Basic Pay" },
  { label: "OT Pay", key: "OT Pay" },
  { label: "Net Pay", key: "Net Pay" },
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

function getValueByAliases(row, aliases) {
  for (const name of aliases) {
    if (Object.prototype.hasOwnProperty.call(row || {}, name)) {
      return row?.[name];
    }
  }
  return "";
}

function getReportCellDisplayValue(row, key, phInRange) {
  if (key === "Public Holiday") {
    return (row?.[key] ?? "") === "" ? (phInRange ?? "—") : row?.[key];
  }
  return row?.[key] ?? "—";
}

function getNumericCell(row, ...keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatMonthYear(isoDate) {
  if (!isoDate) return "";
  const [year, month] = String(isoDate).split("-").map(Number);
  if (!year || !month) return "";
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function sanitizeFilenamePart(value) {
  return String(value || "Employee")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_");
}

function formatEmployeeCode(employeeId) {
  const n = Number(employeeId || 0);
  if (!n) return "";
  return `E${String(n).padStart(3, "0")}`;
}

export default function AttendanceReport({ from, to, disabled, onAuthError }) {
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [reportRows, setReportRows] = useState([]);
  const [reportOpen, setReportOpen] = useState(true);
  const [phInRange, setPhInRange] = useState(null);
  const [payslipBusyId, setPayslipBusyId] = useState(null);

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
        const fin = String(getValueByAliases(r, ["Fin No.", "Fin No"]) || "").toLowerCase();
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

  async function downloadPayslip(row) {
    try {
      setReportErr("");
      const employeeId = Number(row?.["Employee ID"] || row?.EmployeeId || 0);
      if (!employeeId) throw new Error("Employee ID not found in report row.");

      setPayslipBusyId(employeeId);
      const payslip = await attendanceApi.getPayslip({ from, to, employeeId });
      if (!payslip) throw new Error("Failed to load payslip data.");

      const basicPay = Number(payslip.basicPay || 0);
      const otPay = Number(payslip.otPay || 0);
      const netPay = Number(payslip.netPay || 0);
      const normalHours = Number(payslip.normalWorkingHours || 0);
      const totalHours = Number(payslip.totalWorkingHour || 0);
      const totalOt = Number(payslip.totalOt || 0);
      const monFriOt = Number(payslip.monFriOt || 0);
      const satOt = Number(payslip.satOt || 0);
      const sunPhOt = Number(payslip.sunPhOt || 0);
      const overnightOt = Number(payslip.overnightOt || 0);
      const leaveDays = Number(payslip.totalLeave || 0);
      const workingSunday = Number(payslip.workingSunday || 0);
      const hourlyRate = Number(payslip.hourlyRate || 0);
      const monthYear = formatMonthYear(payslip.periodFrom || from);
      const employeeCode = formatEmployeeCode(payslip.employeeId || employeeId);
      const detailOtRows = [
        ["OT - Weekday", formatMoney(monFriOt)],
        ["OT - Saturday", formatMoney(satOt)],
        ["OT - Sunday / PH", formatMoney(sunPhOt + overnightOt)],
      ];

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const peach = [247, 228, 219];
      let y = 34;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`PAYSLIP - ${String(monthYear || `${from}`.slice(0, 7)).toUpperCase()}`, 24, y);

      y += 24;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Company", 24, y);
      doc.text("UEN", 24, y + 12);
      doc.text("Address", 24, y + 24);
      doc.setFont("helvetica", "normal");
      doc.text(String(payslip.companyName || "WE ENGINEERING PTE. LTD."), 86, y);
      doc.text("202447757M", 86, y + 12);
      doc.text("WGCE@ TOWER 2, 21 BUKIT BATOK CRESCENT, #29-81, SINGAPORE 658060", 86, y + 24, { maxWidth: 230 });

      doc.setFont("helvetica", "bold");
      doc.text("Pay Month", 340, y);
      doc.text("Employee ID", 340, y + 12);
      doc.text("Employee Row (auto)", 340, y + 24);
      doc.setFont("helvetica", "normal");
      doc.text(monthYear.toUpperCase(), 430, y);
      doc.text(employeeCode || String(employeeId), 430, y + 12);
      doc.text(String(payslip.employeeId || employeeId), 430, y + 24);

      y += 56;
      doc.setFillColor(...peach);
      doc.rect(24, y - 9, 170, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Employee Details", 24, y);

      y += 14;
      const employeeDetails = [
        ["Employee ID", employeeCode || String(employeeId)],
        ["Name", String(payslip.staffName || row?.["Staff Name"] || "—").toUpperCase()],
        ["Role", String(payslip.department || "EMPLOYEE").toUpperCase()],
        ["Foreign Worker", "Y"],
        ["Sector", String(payslip.department || "—")],
      ];

      doc.setFontSize(8);
      employeeDetails.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 24, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), 104, y);
        y += 12;
      });

      y += 6;
      doc.setFillColor(...peach);
      doc.rect(24, y - 9, 116, 10, "F");
      doc.rect(280, y - 9, 116, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.text("Earnings", 24, y);
      doc.text("Deductions", 280, y);

      y += 14;
      const leftX = 24;
      const leftAmountX = 220;
      const rightX = 280;
      const rightAmountX = 500;

      const earningRows = [
        ["Basic Pay", formatMoney(basicPay)],
        ["Fixed Allowances", "0.00"],
        ...detailOtRows,
        ["Gross Pay", formatMoney(basicPay + otPay)],
      ];

      const deductionRows = [
        ["Unpaid Leave", "0.00"],
        ["Employee CPF", "0.00"],
        ["Other Deductions", "0.00"],
        ["Total Deductions", "0.00"],
      ];

      const sectionStartY = y;
      earningRows.forEach(([label, value], index) => {
        const rowY = sectionStartY + index * 12;
        doc.setFont("helvetica", "bold");
        doc.text(label, leftX, rowY);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), leftAmountX, rowY, { align: "right" });
      });

      deductionRows.forEach(([label, value], index) => {
        const rowY = sectionStartY + index * 12;
        doc.setFont("helvetica", "bold");
        doc.text(label, rightX, rowY);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), rightAmountX, rowY, { align: "right" });
      });

      y = sectionStartY + Math.max(earningRows.length, deductionRows.length) * 12 + 14;
      doc.setFont("helvetica", "bold");
      doc.text("NET PAY (Bank In Amount)", 24, y);
      doc.text(formatMoney(netPay), 220, y, { align: "right" });

      y += 28;
      doc.text("Attendance Summary", 24, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      [
        ["Normal Working Hours", formatMoney(normalHours)],
        ["Total Working Hours", formatMoney(totalHours)],
        ["Total OT", formatMoney(totalOt)],
        ["Leave Days", String(leaveDays)],
        ["Working Sunday", String(workingSunday)],
        ["Hourly Rate", formatMoney(hourlyRate)],
      ].forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 24, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), 220, y, { align: "right" });
        y += 12;
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("This payslip is computer generated and does not require a signature.", 140, 760, { align: "center" });

      const filename = `${sanitizeFilenamePart(payslip.staffName || row?.["Staff Name"])}_${sanitizeFilenamePart(monthYear || from)}.pdf`;
      doc.save(filename);
    } catch (e) {
      setReportErr(e?.message || "Failed to download payslip");
    } finally {
      setPayslipBusyId(null);
    }
  }

  async function downloadExcel() {
    try {
      setReportErr("");
      if (!from || !to) throw new Error("Please select From and To dates.");

      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);
      qs.set("format", "xlsx");

      const { blob, contentDisposition } = await apiFetchBlob(
        `${REPORT_ENDPOINT}?${qs.toString()}`,
        { method: "GET", auth: true }
      );

      const filename =
        parseContentDispositionFilename(contentDisposition) ||
        `WE_Attendance_${from}_to_${to}.xlsx`;

      downloadBlob(blob, filename);
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

      const headers = DISPLAY_COLUMNS.map((c) => c.label);
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
        body: rowsToExport.map((r) =>
          DISPLAY_COLUMNS.map((c) => String(getReportCellDisplayValue(r, c.key, phInRange)))
        ),
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
            <button className="we-btn-soft we-report-toggle we-btn--apply" type="button" onClick={() => setReportOpen((v) => !v)} disabled={reportBusy}>
              {reportOpen ? "Hide" : "Show"}
            </button>
            <button
              className="we-btn we-btn--load"
              type="button"
              onClick={loadReport}
              disabled={reportBusy || disabled}
            >
              {reportBusy ? "Loading…" : "Load Report"}
            </button>

            <button
              className="we-btn-soft we-btn--load"
              type="button"
              onClick={downloadExcel}
              disabled={reportBusy || disabled || uiRowsCount === 0}
            >
              Download Excel
            </button>

            <button
              className="we-btn-soft we-btn--load"
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
                    <th>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportRows.map((r, idx) => (
                    <tr key={`${r["No."] || idx}-${r["Staff Name"] || ""}`}>
                      {DISPLAY_COLUMNS.map((c) => (
                        <td key={c.key}>
                          {c.key === "Total OT" ? (
                            <b>{getReportCellDisplayValue(r, c.key, phInRange)}</b>
                          ) : (
                            getReportCellDisplayValue(r, c.key, phInRange)
                          )}
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="we-btn-mini"
                          onClick={() => downloadPayslip(r)}
                          disabled={payslipBusyId === Number(r?.["Employee ID"] || 0)}
                        >
                          {payslipBusyId === Number(r?.["Employee ID"] || 0) ? "Building…" : "Payslip"}
                        </button>
                      </td>
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
