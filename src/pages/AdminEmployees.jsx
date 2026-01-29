// src/pages/AdminEmployees.jsx
import { useEffect, useMemo, useState } from "react";
import { createEmployee, listEmployees } from "../api/employees";
import { createUser } from "../api/users";
import { apiFetch } from "../api/client";
import "./AdminEmployees.css";

import EmployeesGrid from "../components/employees/EmployeesGrid";

const ENDPOINTS = {
  holidays: "/api/Holidays",
  leaveTypes: "/api/LeaveTypes",
  leaveRequests: "/api/LeaveRequests",
  approveLeave: (id) => `/api/LeaveRequests/${id}/approve`,
  rejectLeave: (id) => `/api/LeaveRequests/${id}/reject`,
  employees: "/api/Employees",
  employeeById: (id) => `/api/Employees/${id}`,
};

function fmtDateTime(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function fmtDateOnly(v) {
  if (!v) return "—";
  return String(v);
}

function emptyToNull(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

/**
 * Convert any UI date string into backend-safe ISO DateOnly string (YYYY-MM-DD) or null.
 * - input type="date" already gives YYYY-MM-DD
 * - if user somehow has DD-MM-YYYY, convert it
 * - never send "" to backend for DateOnly? (binding can fail)
 */
function toIsoDateOrNull(v) {
  if (!v) return null;

  const s = String(v).trim();
  if (!s) return null;

  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd-mm-yyyy -> yyyy-mm-dd
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return null; // safest for DateOnly model binding
}

/**
 * Backend DateOnly returns "YYYY-MM-DD". Ensure input type=date receives correct format or "".
 */
function fromApiDateToInput(v) {
  if (!v) return "";
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export default function AdminEmployees({ onAuthError }) {
  // Tabs
  const [tab, setTab] = useState("employees");

  // Common UI state
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  function handleErr(e, fallback) {
    const m = e?.message || fallback || "Request failed";
    setMsg(m);
    if (String(m).includes("401") || String(m).includes("403")) onAuthError?.();
  }

  const isSuccess = msg.startsWith("✅");

  // ============================================================
  // 1) EMPLOYEES
  // ============================================================
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [active, setActive] = useState(true);

  // Create form fields
  const [finNo, setFinNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [workPermitNo, setWorkPermitNo] = useState("");
  const [workPermitExpiry, setWorkPermitExpiry] = useState("");

  const [bcssCsocNo, setBcssCsocNo] = useState("");
  const [csocExpiryDate, setCsocExpiryDate] = useState("");

  const [boomLiftExpiryDate, setBoomLiftExpiryDate] = useState("");
  const [scissorLiftExpiryDate, setScissorLiftExpiryDate] = useState("");

  const [showMoreFields, setShowMoreFields] = useState(false);

  // Create login user
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // list + search
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  async function refreshEmployees() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listEmployees(true);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      try {
        const data2 = await listEmployees();
        setRows(Array.isArray(data2) ? data2 : []);
      } catch (e2) {
        handleErr(e2, "Failed to load employees");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((e) => {
      const n = String(e?.name || "").toLowerCase();
      const d = String(e?.department || e?.dept || "").toLowerCase();
      const id = String(e?.id ?? "");
      const st = e?.active ? "active" : "inactive";

      const fin = String(e?.finNo || e?.fin_number || "").toLowerCase();
      const nat = String(e?.nationality || "").toLowerCase();
      const wp = String(e?.workPermitNo || e?.work_permit_no || "").toLowerCase();
      const csoc = String(e?.bcssCsocNo || e?.bcss_csoc_no || "").toLowerCase();

      return n.includes(s) || d.includes(s) || id.includes(s) || st.includes(s) || fin.includes(s) || nat.includes(s) || wp.includes(s) || csoc.includes(s);
    });
  }, [rows, q]);

  async function onCreateEmployee(e) {
    e.preventDefault();
    setMsg("");

    const n = name.trim();
    const d = department.trim();
    if (!n) return setMsg("Name is required");
    if (!d) return setMsg("Department is required");

    setLoading(true);
    try {
      await createEmployee({
        name: n,
        department: d,
        active,

        finNo: emptyToNull(finNo),
        nationality: emptyToNull(nationality),

        // ✅ send DateOnly as ISO or null (never "")
        dateOfBirth: toIsoDateOrNull(dateOfBirth),

        workPermitNo: emptyToNull(workPermitNo),
        workPermitExpiry: toIsoDateOrNull(workPermitExpiry),

        bcssCsocNo: emptyToNull(bcssCsocNo),
        csocExpiryDate: toIsoDateOrNull(csocExpiryDate),

        boomLiftExpiryDate: toIsoDateOrNull(boomLiftExpiryDate),
        scissorLiftExpiryDate: toIsoDateOrNull(scissorLiftExpiryDate),
      });

      setName("");
      setDepartment("");
      setActive(true);

      setFinNo("");
      setNationality("");
      setDateOfBirth("");
      setWorkPermitNo("");
      setWorkPermitExpiry("");
      setBcssCsocNo("");
      setCsocExpiryDate("");
      setBoomLiftExpiryDate("");
      setScissorLiftExpiryDate("");

      await refreshEmployees();
      setMsg("✅ Employee created");
    } catch (e2) {
      handleErr(e2, "Create employee failed");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateLogin(e) {
    e.preventDefault();
    setMsg("");

    const empIdNum = Number(selectedEmployeeId);
    if (!empIdNum || empIdNum <= 0) return setMsg("Select an employee");
    if (!newUsername.trim()) return setMsg("Username is required");
    if (!newPassword) return setMsg("Password is required");

    setLoading(true);
    try {
      await createUser({
        employeeId: empIdNum,
        username: newUsername.trim(),
        password: newPassword,
      });

      setSelectedEmployeeId("");
      setNewUsername("");
      setNewPassword("");
      setMsg("✅ Login user created");
    } catch (e2) {
      handleErr(e2, "Create user failed");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------
  // Edit Employee Modal (PATCH)
  // -----------------------
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editRow, setEditRow] = useState(null);

  // editable fields
  const [eName, setEName] = useState("");
  const [eDepartment, setEDepartment] = useState("");
  const [eActive, setEActive] = useState(true);

  const [eFinNo, setEFinNo] = useState("");
  const [eNationality, setENationality] = useState("");
  const [eDob, setEDob] = useState("");

  const [eWorkPermitNo, setEWorkPermitNo] = useState("");
  const [eWorkPermitExpiry, setEWorkPermitExpiry] = useState("");

  const [eBcssCsocNo, setEBcssCsocNo] = useState("");
  const [eCsocExpiryDate, setECsocExpiryDate] = useState("");

  const [eBoomLiftExpiryDate, setEBoomLiftExpiryDate] = useState("");
  const [eScissorLiftExpiryDate, setEScissorLiftExpiryDate] = useState("");

  function openEdit(emp) {
    setEditErr("");
    setEditRow(emp);
    setEditOpen(true);

    setEName(emp?.name || "");
    setEDepartment(emp?.department || emp?.dept || "");
    setEActive(!!emp?.active);

    setEFinNo(emp?.finNo || emp?.fin_number || "");
    setENationality(emp?.nationality || "");

    // ✅ ensure date inputs always get YYYY-MM-DD or ""
    setEDob(fromApiDateToInput(emp?.dateOfBirth || emp?.dob || emp?.date_of_birth));

    setEWorkPermitNo(emp?.workPermitNo || emp?.work_permit_no || "");
    setEWorkPermitExpiry(
      fromApiDateToInput(emp?.workPermitExpiry || emp?.work_permit_expiry || emp?.work_permit_expiry_date)
    );

    setEBcssCsocNo(emp?.bcssCsocNo || emp?.bcss_csoc_no || "");
    setECsocExpiryDate(
      fromApiDateToInput(emp?.csocExpiryDate || emp?.csoc_expiry_date || emp?.bcss_csoc_expiry_date)
    );

    setEBoomLiftExpiryDate(fromApiDateToInput(emp?.boomLiftExpiryDate || emp?.boom_lift_expiry_date));
    setEScissorLiftExpiryDate(fromApiDateToInput(emp?.scissorLiftExpiryDate || emp?.scissor_lift_expiry_date));
  }

  function closeEdit() {
    if (editSaving) return;
    setEditOpen(false);
    setEditRow(null);
    setEditErr("");
  }

  async function saveEdit() {
    if (!editRow?.id) return;
    setEditErr("");
    setEditSaving(true);
    setMsg("");

    try {
      const payload = {
        name: emptyToNull(eName),
        department: eDepartment != null ? String(eDepartment) : null,
        active: !!eActive,

        finNo: eFinNo != null ? String(eFinNo) : null,
        nationality: eNationality != null ? String(eNationality) : null,

        // ✅ send DateOnly as ISO or null
        dateOfBirth: toIsoDateOrNull(eDob),

        workPermitNo: eWorkPermitNo != null ? String(eWorkPermitNo) : null,
        workPermitExpiry: toIsoDateOrNull(eWorkPermitExpiry),

        bcssCsocNo: eBcssCsocNo != null ? String(eBcssCsocNo) : null,
        csocExpiryDate: toIsoDateOrNull(eCsocExpiryDate),

        boomLiftExpiryDate: toIsoDateOrNull(eBoomLiftExpiryDate),
        scissorLiftExpiryDate: toIsoDateOrNull(eScissorLiftExpiryDate),
      };

      await apiFetch(ENDPOINTS.employeeById(editRow.id), {
        method: "PATCH",
        body: payload,
      });

      await refreshEmployees();
      setMsg("✅ Employee updated");
      closeEdit();
    } catch (e) {
      setEditErr(e?.message || "Update failed");
      if (String(e?.message || "").includes("401") || String(e?.message || "").includes("403")) onAuthError?.();
    } finally {
      setEditSaving(false);
    }
  }

  // ============================================================
  // 2) HOLIDAYS
  // ============================================================
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  async function loadHolidays() {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch(ENDPOINTS.holidays, { method: "GET" });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (e) {
      handleErr(e, "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }

  async function addHoliday(e) {
    e.preventDefault();
    setMsg("");

    if (!holidayDate) return setMsg("Holiday date is required");
    if (!holidayName.trim()) return setMsg("Holiday name is required");

    setLoading(true);
    try {
      await apiFetch(ENDPOINTS.holidays, {
        method: "POST",
        body: { date: holidayDate, name: holidayName.trim() },
      });
      setHolidayDate("");
      setHolidayName("");
      await loadHolidays();
      setMsg("✅ Holiday added");
    } catch (e2) {
      handleErr(e2, "Add holiday failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteHoliday(id) {
    if (!id) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch(`${ENDPOINTS.holidays}/${id}`, { method: "DELETE" });
      await loadHolidays();
      setMsg("✅ Holiday deleted");
    } catch (e) {
      handleErr(e, "Delete holiday failed");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 3) LEAVE TYPES
  // ============================================================
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [ltCode, setLtCode] = useState("AL");
  const [ltName, setLtName] = useState("Annual Leave");
  const [ltPaid, setLtPaid] = useState(true);
  const [ltActive, setLtActive] = useState(true);

  async function loadLeaveTypes() {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch(ENDPOINTS.leaveTypes, { method: "GET" });
      setLeaveTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      handleErr(e, "Failed to load leave types");
    } finally {
      setLoading(false);
    }
  }

  async function addLeaveType(e) {
    e.preventDefault();
    setMsg("");

    if (!ltCode.trim()) return setMsg("Code is required (e.g. AL, MC)");
    if (!ltName.trim()) return setMsg("Name is required");

    setLoading(true);
    try {
      await apiFetch(ENDPOINTS.leaveTypes, {
        method: "POST",
        body: {
          code: ltCode.trim().toUpperCase(),
          name: ltName.trim(),
          paid: !!ltPaid,
          active: !!ltActive,
        },
      });
      await loadLeaveTypes();
      setMsg("✅ Leave type created");
    } catch (e2) {
      handleErr(e2, "Create leave type failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleLeaveTypeActive(t) {
    if (!t?.id) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch(`${ENDPOINTS.leaveTypes}/${t.id}`, {
        method: "PUT",
        body: { ...t, active: !t.active },
      });
      await loadLeaveTypes();
      setMsg("✅ Leave type updated");
    } catch (e) {
      handleErr(e, "Update leave type failed");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // 4) LEAVE APPROVALS
  // ============================================================
  const [pendingLeaves, setPendingLeaves] = useState([]);

  async function loadPendingLeaves() {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch(`${ENDPOINTS.leaveRequests}?status=Pending`, { method: "GET" });
      setPendingLeaves(Array.isArray(data) ? data : []);
    } catch (e) {
      handleErr(e, "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }

  async function approveLeave(id) {
    if (!id) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch(ENDPOINTS.approveLeave(id), { method: "POST" });
      await loadPendingLeaves();
      setMsg("✅ Leave approved");
    } catch (e) {
      handleErr(e, "Approve failed (check endpoint)");
    } finally {
      setLoading(false);
    }
  }

  async function rejectLeave(id) {
    if (!id) return;
    setLoading(true);
    setMsg("");
    try {
      await apiFetch(ENDPOINTS.rejectLeave(id), { method: "POST" });
      await loadPendingLeaves();
      setMsg("✅ Leave rejected");
    } catch (e) {
      handleErr(e, "Reject failed (check endpoint)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "holidays") loadHolidays();
    if (tab === "leaveTypes") loadLeaveTypes();
    if (tab === "approvals") loadPendingLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="we-admin-page">
      {/* Header */}
      <div className="we-admin-head">
        <div>
          <div className="we-admin-kicker">Admin panel</div>
          <div className="we-admin-title">Admin</div>
          <div className="we-admin-sub">Manage employees • holidays • leave types • approvals</div>
        </div>

        <button
          className="we-btn-soft we-admin-refresh"
          onClick={() => {
            if (tab === "employees") refreshEmployees();
            if (tab === "holidays") loadHolidays();
            if (tab === "leaveTypes") loadLeaveTypes();
            if (tab === "approvals") loadPendingLeaves();
          }}
          disabled={loading}
        >
          {loading ? (
            <span className="we-btn-spin">
              <span className="spinner" />
              Loading…
            </span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="we-admin-tabs">
        <button className={`we-tab ${tab === "employees" ? "on" : ""}`} onClick={() => setTab("employees")}>
          👷 Employees
        </button>
        <button className={`we-tab ${tab === "holidays" ? "on" : ""}`} onClick={() => setTab("holidays")}>
          🎌 Holidays
        </button>
        <button className={`we-tab ${tab === "leaveTypes" ? "on" : ""}`} onClick={() => setTab("leaveTypes")}>
          🧾 Leave Types
        </button>
        <button className={`we-tab ${tab === "approvals" ? "on" : ""}`} onClick={() => setTab("approvals")}>
          ✅ Leave Approvals
        </button>
      </div>

      {/* Message */}
      {msg ? <div className={`we-admin-msg ${isSuccess ? "ok" : "bad"}`}>{msg}</div> : null}

      {/* EMPLOYEES TAB */}
      {tab === "employees" ? (
        <>
          <div className="we-admin-grid">
            {/* Create Login User */}
            <div className="we-admin-card">
              <div className="we-admin-cardTitle">Create Login (Username / Password)</div>

              <form onSubmit={onCreateLogin} className="we-admin-form">
                <label className="we-admin-label">
                  Employee
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">👤</span>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="we-admin-select"
                    >
                      <option value="">Select employee…</option>
                      {rows.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} (ID: {emp.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="we-admin-label">
                  Username
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">⌨️</span>
                    <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username" />
                  </div>
                </label>

                <label className="we-admin-label">
                  Password
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🔒</span>
                    <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password" type="password" />
                  </div>
                </label>

                <button className="we-btn" disabled={loading}>
                  {loading ? (
                    <span className="we-btn-spin">
                      <span className="spinner" />
                      Saving…
                    </span>
                  ) : (
                    "Create Login User"
                  )}
                </button>
              </form>
            </div>

            {/* Create Employee */}
            <div className="we-admin-card">
              <div className="we-admin-cardTitle">Create Employee</div>

              <form onSubmit={onCreateEmployee} className="we-admin-form">
                <label className="we-admin-label">
                  Name
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🪪</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee name" />
                  </div>
                </label>

                <label className="we-admin-label">
                  Department
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🏢</span>
                    <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department (e.g. WE Engineering)" />
                  </div>
                </label>

                <div className="we-admin-two">
                  <label className="we-admin-label">
                    Fin No.
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">🪪</span>
                      <input value={finNo} onChange={(e) => setFinNo(e.target.value)} placeholder="Fin No." />
                    </div>
                  </label>

                  <label className="we-admin-label">
                    Nationality
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">🌍</span>
                      <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Nationality" />
                    </div>
                  </label>
                </div>

                <label className="we-admin-label">
                  Date of Birth
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🎂</span>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </div>
                </label>

                <label className="we-admin-check">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  Active
                </label>

                <button type="button" className="we-btn-soft" onClick={() => setShowMoreFields((v) => !v)} disabled={loading}>
                  {showMoreFields ? "Hide permit/cert fields" : "Show permit/cert fields"}
                </button>

                {showMoreFields ? (
                  <div className="we-admin-more">
                    <div className="we-admin-two">
                      <label className="we-admin-label">
                        Work Permit No.
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">🧾</span>
                          <input value={workPermitNo} onChange={(e) => setWorkPermitNo(e.target.value)} placeholder="Work Permit No." />
                        </div>
                      </label>

                      <label className="we-admin-label">
                        Work Permit Expiry
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">📅</span>
                          <input type="date" value={workPermitExpiry} onChange={(e) => setWorkPermitExpiry(e.target.value)} />
                        </div>
                      </label>
                    </div>

                    <div className="we-admin-two">
                      <label className="we-admin-label">
                        BCSS / CSOC No.
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">🪪</span>
                          <input value={bcssCsocNo} onChange={(e) => setBcssCsocNo(e.target.value)} placeholder="BCSS / CSOC No." />
                        </div>
                      </label>

                      <label className="we-admin-label">
                        CSOC Expiry Date
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">📅</span>
                          <input type="date" value={csocExpiryDate} onChange={(e) => setCsocExpiryDate(e.target.value)} />
                        </div>
                      </label>
                    </div>

                    <div className="we-admin-two">
                      <label className="we-admin-label">
                        Boom Lift Expiry Date
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">🏗️</span>
                          <input type="date" value={boomLiftExpiryDate} onChange={(e) => setBoomLiftExpiryDate(e.target.value)} />
                        </div>
                      </label>

                      <label className="we-admin-label">
                        Scissor Lift Expiry Date
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">🪜</span>
                          <input type="date" value={scissorLiftExpiryDate} onChange={(e) => setScissorLiftExpiryDate(e.target.value)} />
                        </div>
                      </label>
                    </div>
                  </div>
                ) : null}

                <button className="we-btn" disabled={loading}>
                  {loading ? (
                    <span className="we-btn-spin">
                      <span className="spinner" />
                      Saving…
                    </span>
                  ) : (
                    "Add Employee"
                  )}
                </button>
              </form>
            </div>
          </div>

          <EmployeesGrid
            rows={filteredRows}
            loading={loading}
            q={q}
            setQ={setQ}
            onEdit={openEdit}
            fmtDateOnly={fmtDateOnly}
            fmtDateTime={fmtDateTime}
          />

          {/* ---- Edit Modal ---- */}
          {editOpen ? (
            <div className="we-modalBack" role="dialog" aria-modal="true" onMouseDown={closeEdit}>
              <div className="we-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="we-modalHead">
                  <div>
                    <div className="we-modalTitle">Edit employee</div>
                    <div className="we-modalSub">
                      ID #{editRow?.id} • Created {fmtDateTime(editRow?.createdAt)}
                    </div>
                  </div>
                  <button className="we-btn-x" onClick={closeEdit} disabled={editSaving}>
                    ✕
                  </button>
                </div>

                <div className="we-modalBody">
                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Name
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🪪</span>
                        <input value={eName} onChange={(ev) => setEName(ev.target.value)} />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Department
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🏢</span>
                        <input value={eDepartment} onChange={(ev) => setEDepartment(ev.target.value)} />
                      </div>
                    </label>
                  </div>

                  <label className="we-admin-check">
                    <input type="checkbox" checked={eActive} onChange={(ev) => setEActive(ev.target.checked)} />
                    Active
                  </label>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Fin No.
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🪪</span>
                        <input value={eFinNo} onChange={(ev) => setEFinNo(ev.target.value)} />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Nationality
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🌍</span>
                        <input value={eNationality} onChange={(ev) => setENationality(ev.target.value)} />
                      </div>
                    </label>
                  </div>

                  <label className="we-admin-label">
                    Date of Birth
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">🎂</span>
                      <input type="date" value={eDob} onChange={(ev) => setEDob(ev.target.value)} />
                    </div>
                  </label>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Work Permit No.
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🧾</span>
                        <input value={eWorkPermitNo} onChange={(ev) => setEWorkPermitNo(ev.target.value)} />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Work Permit Expiry
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">📅</span>
                        <input type="date" value={eWorkPermitExpiry} onChange={(ev) => setEWorkPermitExpiry(ev.target.value)} />
                      </div>
                    </label>
                  </div>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      BCSS / CSOC No.
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🪪</span>
                        <input value={eBcssCsocNo} onChange={(ev) => setEBcssCsocNo(ev.target.value)} />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      CSOC Expiry Date
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">📅</span>
                        <input type="date" value={eCsocExpiryDate} onChange={(ev) => setECsocExpiryDate(ev.target.value)} />
                      </div>
                    </label>
                  </div>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Boom Lift Expiry Date
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🏗️</span>
                        <input type="date" value={eBoomLiftExpiryDate} onChange={(ev) => setEBoomLiftExpiryDate(ev.target.value)} />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Scissor Lift Expiry Date
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">🪜</span>
                        <input type="date" value={eScissorLiftExpiryDate} onChange={(ev) => setEScissorLiftExpiryDate(ev.target.value)} />
                      </div>
                    </label>
                  </div>

                  {editErr ? <div className="we-admin-msg bad">{editErr}</div> : null}
                </div>

                <div className="we-modalFoot">
                  <button className="we-btn-soft" onClick={closeEdit} disabled={editSaving}>Cancel</button>
                  <button className="we-btn" onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? (
                      <span className="we-btn-spin"><span className="spinner" />Saving…</span>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* HOLIDAYS / LEAVE TYPES / APPROVALS: keep as-is in your file (no change needed) */}
      {tab === "holidays" ? (
        <>
          <div className="we-admin-card">
            <div className="we-admin-cardTitle">Create Public Holiday</div>
            <form onSubmit={addHoliday} className="we-admin-form">
              <label className="we-admin-label">
                Date
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">📅</span>
                  <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
                </div>
              </label>

              <label className="we-admin-label">
                Name
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">🏷️</span>
                  <input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="e.g. New Year" />
                </div>
              </label>

              <button className="we-btn" disabled={loading}>{loading ? "Saving…" : "Add Holiday"}</button>
            </form>
          </div>

          <div className="we-admin-card">
            <div className="we-admin-listHead">
              <div className="we-admin-cardTitle">Holidays ({holidays.length})</div>
              <span className="we-admin-hint">Used to compute PH work / leave</span>
            </div>

            <div className="we-admin-list">
              {holidays.length === 0 ? (
                <div className="we-admin-empty">{loading ? "Loading…" : "No holidays yet."}</div>
              ) : (
                holidays
                  .slice()
                  .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                  .map((h) => (
                    <div key={h.id} className="we-admin-row">
                      <div className="we-admin-rowTop">
                        <div className="we-admin-name">{h.name || "(no name)"}</div>
                        <button className="we-btn-soft" onClick={() => deleteHoliday(h.id)} disabled={loading}>
                          Delete
                        </button>
                      </div>
                      <div className="we-admin-meta2">
                        <span>Date: {fmtDateOnly(h.date)}</span>
                        <span className="we-admin-dot">•</span>
                        <span>ID: {h.id}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* LEAVE TYPES TAB */}
      {tab === "leaveTypes" ? (
        <>
          <div className="we-admin-card">
            <div className="we-admin-cardTitle">Create Leave Type</div>

            <form onSubmit={addLeaveType} className="we-admin-form">
              <label className="we-admin-label">
                Code
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">🧾</span>
                  <input
                    value={ltCode}
                    onChange={(e) => setLtCode(e.target.value)}
                    placeholder="AL / MC / etc"
                  />
                </div>
              </label>

              <label className="we-admin-label">
                Name
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">🏷️</span>
                  <input
                    value={ltName}
                    onChange={(e) => setLtName(e.target.value)}
                    placeholder="Annual Leave"
                  />
                </div>
              </label>

              <label className="we-admin-check">
                <input
                  type="checkbox"
                  checked={ltPaid}
                  onChange={(e) => setLtPaid(e.target.checked)}
                />
                Paid
              </label>

              <label className="we-admin-check">
                <input
                  type="checkbox"
                  checked={ltActive}
                  onChange={(e) => setLtActive(e.target.checked)}
                />
                Active
              </label>

              <button className="we-btn" disabled={loading}>
                {loading ? "Saving…" : "Create Leave Type"}
              </button>
            </form>
          </div>

          <div className="we-admin-card">
            <div className="we-admin-listHead">
              <div className="we-admin-cardTitle">Leave Types ({leaveTypes.length})</div>
              <span className="we-admin-hint">MC / AL / etc</span>
            </div>

            <div className="we-admin-list">
              {leaveTypes.length === 0 ? (
                <div className="we-admin-empty">{loading ? "Loading…" : "No leave types yet."}</div>
              ) : (
                leaveTypes.map((t) => (
                  <div key={t.id} className="we-admin-row">
                    <div className="we-admin-rowTop">
                      <div className="we-admin-name">
                        {t.code} — {t.name}
                      </div>
                      <button
                        className="we-btn-soft"
                        onClick={() => toggleLeaveTypeActive(t)}
                        disabled={loading}
                      >
                        {t.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>

                    <div className="we-admin-meta2">
                      <span>Paid: {t.paid ? "Yes" : "No"}</span>
                      <span className="we-admin-dot">•</span>
                      <span>Status: {t.active ? "Active" : "Inactive"}</span>
                      <span className="we-admin-dot">•</span>
                      <span>ID: {t.id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* APPROVALS TAB */}
      {tab === "approvals" ? (
        <div className="we-admin-card">
          <div className="we-admin-listHead">
            <div className="we-admin-cardTitle">
              Pending Leave Requests ({pendingLeaves.length})
            </div>
            <span className="we-admin-hint">Approve / Reject</span>
          </div>

          <div className="we-admin-list">
            {pendingLeaves.length === 0 ? (
              <div className="we-admin-empty">{loading ? "Loading…" : "No pending leave."}</div>
            ) : (
              pendingLeaves.map((r) => (
                <div key={r.id} className="we-admin-row">
                  <div className="we-admin-rowTop">
                    <div className="we-admin-name">
                      #{r.id} • {r.employee?.name || `Employee ${r.employeeId}`}
                    </div>
                    <div className="we-approveBtns">
                      <button
                        className="we-btn"
                        onClick={() => approveLeave(r.id)}
                        disabled={loading}
                      >
                        Approve
                      </button>
                      <button
                        className="we-btn danger"
                        onClick={() => rejectLeave(r.id)}
                        disabled={loading}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="we-admin-meta">
                    <span className="we-admin-muted">
                      Type: {r.leaveType?.code || r.leaveTypeCode || r.leaveTypeId}
                    </span>
                  </div>

                  <div className="we-admin-meta2">
                    <span>
                      {fmtDateOnly(r.startDate)} → {fmtDateOnly(r.endDate)}
                    </span>
                    <span className="we-admin-dot">•</span>
                    <span>Status: {r.status}</span>
                  </div>

                  {r.reason ? (
                    <div className="we-admin-reason">Reason: {r.reason}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}