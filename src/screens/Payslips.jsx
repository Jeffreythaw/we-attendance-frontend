import React, { useEffect, useState } from "react";
import { listEmployees } from "../api/employees";
import { attendanceApi } from "../api/attendance";
import { downloadPayslipPdf } from "../utils/payslipPdf";
import "./Payslips.css";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function monthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function Payslips({ onAuthError }) {
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState([]);
  const [allowances, setAllowances] = useState({});
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const [staff, savedAllowances] = await Promise.all([
          listEmployees(),
          attendanceApi.getPayslipAllowances({ month: `${month}-01` }),
        ]);
        if (cancelled) return;
        setEmployees(staff);
        setAllowances(Object.fromEntries(savedAllowances.map((row) => [row.employeeId, String(row.amount ?? 0)])));
      } catch (e) {
        if (cancelled) return;
        if (Number(e?.status) === 401 || Number(e?.status) === 403) onAuthError?.();
        else setError(e?.message || "Failed to load payslips.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [month, onAuthError]);

  async function loadPreview(employee) {
    try {
      setError("");
      setPreviewLoading(true);
      const payslip = await attendanceApi.getPayslip({ ...monthRange(month), employeeId: employee.id });
      setPreview(payslip);
    } catch (e) {
      if (Number(e?.status) === 401 || Number(e?.status) === 403) onAuthError?.();
      else setError(e?.message || "Failed to load payslip.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreview(employee) {
    setPreviewEmployee(employee);
    setPreview(null);
    loadPreview(employee);
  }

  async function saveAllowance(employeeId) {
    const amount = Number(allowances[employeeId] || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Allowance must be a non-negative amount.");
      return;
    }

    try {
      setError("");
      setSavingId(employeeId);
      const saved = await attendanceApi.savePayslipAllowance({ employeeId, payrollMonth: `${month}-01`, amount });
      setAllowances((current) => ({ ...current, [employeeId]: String(saved.amount ?? amount) }));
      if (previewEmployee?.id === employeeId) await loadPreview(previewEmployee);
    } catch (e) {
      if (Number(e?.status) === 401 || Number(e?.status) === 403) onAuthError?.();
      else setError(e?.message || "Failed to save allowance.");
    } finally {
      setSavingId(null);
    }
  }

  async function download(employee) {
    try {
      setError("");
      setDownloadingId(employee.id);
      await downloadPayslipPdf({ ...monthRange(month), employeeId: employee.id, staffName: employee.name });
    } catch (e) {
      if (Number(e?.status) === 401 || Number(e?.status) === 403) onAuthError?.();
      else setError(e?.message || "Failed to build payslip.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="we-glass-card we-reportCard">
      <div className="we-reportActions">
        <div className="we-reportTopRow">
          <div>
            <div className="we-admin-sectionTitle">Payslips</div>
            <div className="we-admin-sectionMeta">Open an employee payslip to review database values and enter the fixed allowance in the PDF-style view.</div>
          </div>
          <label className="we-a-label" style={{ minWidth: 170 }}>
            Pay month
            <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPreviewEmployee(null); setPreview(null); }} />
          </label>
        </div>
      </div>

      {error ? <div className="we-error">{error}</div> : null}

      <div className="we-admin-tableWrap">
        <table className="we-admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Monthly Basic</th>
              <th>Payslip</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const downloading = downloadingId === employee.id;
              return (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{Number(employee.monthlyBasicSalary || 0).toFixed(2)}</td>
                  <td>
                    <div className="we-payslip-actions">
                      <button type="button" className="we-btn-mini we-btn--edit" onClick={() => openPreview(employee)}>View / Edit</button>
                      <button type="button" className="we-btn-mini" onClick={() => download(employee)} disabled={downloading}>
                        {downloading ? "Building…" : "Download PDF"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {previewEmployee ? (
        <div className="we-modalBack we-payslip-modalBack" role="dialog" aria-modal="true" aria-label="Payslip preview" onMouseDown={() => setPreviewEmployee(null)}>
          <div className="we-payslip-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="we-payslip-modalHead">
              <div>
                <div className="we-modalTitle">Payslip preview</div>
                <div className="we-modalSub">Database values are read-only. Fixed Allowance is the only manual field.</div>
              </div>
              <button type="button" className="we-btn-mini" onClick={() => setPreviewEmployee(null)}>Close</button>
            </div>

            {previewLoading || !preview ? <div className="we-payslip-loading">Loading payslip…</div> : (
              <div className="we-payslip-paper">
                <div className="we-payslip-paperHead">
                  <div>
                    <div className="we-payslip-company">{preview.companyName || "WE ENGINEERING PTE. LTD."}</div>
                    <div className="we-payslip-muted">WCEGA TOWER, 21 BUKIT BATOK CRESCENT, #29-81, SINGAPORE 658060</div>
                  </div>
                  <div className="we-payslip-title">PAYSLIP<br /><span>{monthLabel(month).toUpperCase()}</span></div>
                </div>

                <div className="we-payslip-section">
                  <div><b>Employee</b><span>{preview.staffName || previewEmployee.name}</span></div>
                  <div><b>Employee ID</b><span>E{String(preview.employeeId || previewEmployee.id).padStart(3, "0")}</span></div>
                  <div><b>Department</b><span>{preview.department || "EMPLOYEE"}</span></div>
                </div>

                <div className="we-payslip-columns">
                  <div>
                    <h3>Earnings</h3>
                    <div className="we-payslip-row"><span>Basic Pay</span><b>{money(preview.basicPay)}</b></div>
                    <div className="we-payslip-row"><span>Basic Salary Payable</span><b>{money(preview.basicSalaryPayable)}</b></div>
                    <label className="we-payslip-row we-payslip-manual"><span>Fixed Allowance <small>Manual</small></span><input aria-label="Fixed allowance" type="number" min="0" step="0.01" value={allowances[previewEmployee.id] ?? "0"} onChange={(e) => setAllowances((current) => ({ ...current, [previewEmployee.id]: e.target.value }))} disabled={savingId === previewEmployee.id} /></label>
                    <div className="we-payslip-row"><span>OT Pay</span><b>{money(preview.otPay)}</b></div>
                    <div className="we-payslip-row we-payslip-total"><span>Gross Pay</span><b>{money(preview.grossPay)}</b></div>
                  </div>
                  <div>
                    <h3>Deductions</h3>
                    <div className="we-payslip-row"><span>Unpaid Leave</span><b>{money(preview.unpaidLeaveDeduction)}</b></div>
                    <div className="we-payslip-row"><span>Total Deductions</span><b>{money(preview.totalDeductions)}</b></div>
                    <div className="we-payslip-net"><span>NET PAY</span><b>{money(preview.netPay)}</b></div>
                  </div>
                </div>

                <div className="we-payslip-summary">
                  <b>Attendance summary</b>
                  <span>Working hours: {money(preview.totalWorkingHour)}</span>
                  <span>Total OT: {money(preview.totalOt)}</span>
                  <span>Leave days: {preview.totalLeave || 0}</span>
                  <span>Payable days: {money(preview.totalPayableDays)}</span>
                </div>

                <div className="we-payslip-foot">
                  <span>Save the allowance to recalculate Gross and Net Pay from the database.</span>
                  <div className="we-payslip-actions">
                    <button type="button" className="we-btn-mini we-btn--save" onClick={() => saveAllowance(previewEmployee.id)} disabled={savingId === previewEmployee.id}>{savingId === previewEmployee.id ? "Saving…" : "Save allowance"}</button>
                    <button type="button" className="we-btn-mini" onClick={() => download(previewEmployee)} disabled={downloadingId === previewEmployee.id}>{downloadingId === previewEmployee.id ? "Building…" : "Download PDF"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
