import React, { useEffect, useState } from "react";
import { listEmployees } from "../api/employees";
import { attendanceApi } from "../api/attendance";
import { downloadPayslipPdf } from "../utils/payslipPdf";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export default function Payslips({ onAuthError }) {
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState([]);
  const [allowances, setAllowances] = useState({});
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

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
            <div className="we-admin-sectionMeta">Choose a month, enter any fixed allowance, save it, then download the employee payslip.</div>
          </div>
          <label className="we-a-label" style={{ minWidth: 170 }}>
            Pay month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
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
              <th>Fixed Allowance</th>
              <th>Payslip</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const saving = savingId === employee.id;
              const downloading = downloadingId === employee.id;
              return (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{Number(employee.monthlyBasicSalary || 0).toFixed(2)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        aria-label={`Fixed allowance for ${employee.name}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={allowances[employee.id] ?? "0"}
                        onChange={(e) => setAllowances((current) => ({ ...current, [employee.id]: e.target.value }))}
                        disabled={saving}
                        style={{ width: 100 }}
                      />
                      <button type="button" className="we-btn-mini we-btn--save" onClick={() => saveAllowance(employee.id)} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <button type="button" className="we-btn-mini" onClick={() => download(employee)} disabled={downloading}>
                      {downloading ? "Building…" : "Download PDF"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
