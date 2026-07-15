import { attendanceApi } from "../api/attendance";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatMonthYear(isoDate) {
  if (!isoDate) return "";
  const [year, month] = String(isoDate).split("-").map(Number);
  if (!year || !month) return "";
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function sanitizeFilenamePart(value) {
  const cleaned = Array.from(String(value || "Employee").trim())
    .filter((ch) => ch.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(ch))
    .join("");
  return cleaned.replace(/\s+/g, "_");
}

function formatEmployeeCode(employeeId) {
  const n = Number(employeeId || 0);
  return n ? `E${String(n).padStart(3, "0")}` : "";
}

export async function downloadPayslipPdf({ from, to, employeeId, staffName }) {
  const payslip = await attendanceApi.getPayslip({ from, to, employeeId });
  if (!payslip) throw new Error("Failed to load payslip data.");

  const basicPay = Number(payslip.basicPay || 0);
  const basicSalaryPayable = Number(payslip.basicSalaryPayable || 0);
  const allowance = Number(payslip.allowance || 0);
  const employeeCpf = Number(payslip.employeeCpf || 0);
  const otherDeductions = Number(payslip.otherDeductions || 0);
  const grossPay = Number(payslip.grossPay || 0);
  const netPay = Number(payslip.netPay || 0);
  const unpaidLeaveDeduction = Number(payslip.unpaidLeaveDeduction || 0);
  const totalDeductions = Number(payslip.totalDeductions || 0);
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
  const payrollDivisor = Number(payslip.payrollDivisor || 0);
  const phPayDays = Number(payslip.publicHolidayPayDays || 0);
  const payableDays = Number(payslip.totalPayableDays || 0);
  const monthYear = formatMonthYear(payslip.periodFrom || from);
  const employeeCode = formatEmployeeCode(payslip.employeeId || employeeId);
  const detailOtRows = [
    ["OT - Weekday", formatMoney(monFriOt)],
    ["OT - Saturday", formatMoney(satOt)],
    ["OT - Sunday / PH", formatMoney(sunPhOt)],
    ["OT - Overnight", formatMoney(overnightOt)],
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
  doc.text("WCEGA TOWER, 21 BUKIT BATOK CRESCENT, #29-81, SINGAPORE 658060", 86, y + 24, { maxWidth: 230 });

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
    ["Name", String(payslip.staffName || staffName || "—").toUpperCase()],
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
  const earningRows = [
    ["Basic Pay", formatMoney(basicPay)],
    ["Basic Salary Payable", formatMoney(basicSalaryPayable)],
    ["Fixed Allowances", formatMoney(allowance)],
    ...detailOtRows,
    ["Gross Pay", formatMoney(grossPay)],
  ];
  const deductionRows = [
    ["Unpaid Leave", formatMoney(unpaidLeaveDeduction)],
    ["Employee CPF", formatMoney(employeeCpf)],
    ["Other Deductions", formatMoney(otherDeductions)],
    ["Total Deductions", formatMoney(totalDeductions)],
  ];
  const sectionStartY = y;
  earningRows.forEach(([label, value], index) => {
    const rowY = sectionStartY + index * 12;
    doc.setFont("helvetica", "bold");
    doc.text(label, 24, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 220, rowY, { align: "right" });
  });
  deductionRows.forEach(([label, value], index) => {
    const rowY = sectionStartY + index * 12;
    doc.setFont("helvetica", "bold");
    doc.text(label, 280, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 500, rowY, { align: "right" });
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
    ["PH Pay Days", formatMoney(phPayDays)],
    ["Payable Days", formatMoney(payableDays)],
    ["Payroll Divisor", formatMoney(payrollDivisor)],
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
  doc.save(`${sanitizeFilenamePart(payslip.staffName || staffName)}_${sanitizeFilenamePart(monthYear || from)}.pdf`);
}
