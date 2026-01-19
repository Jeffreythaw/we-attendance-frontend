// src/pages/AdminEmployees.jsx
import { useEffect, useMemo, useState } from "react";
import { createEmployee, listEmployees } from "../api/employees";
import { createUser } from "../api/users";
import { apiFetch } from "../api/client";

/**
 * Adjust these to match your backend routes if needed.
 */
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
  return String(v); // DateOnly often is "YYYY-MM-DD"
}

function emptyToNull(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

export default function AdminEmployees({ onAuthError }) {
  // -----------------------
  // Tabs
  // -----------------------
  const [tab, setTab] = useState("employees"); // employees | holidays | leaveTypes | approvals

  // -----------------------
  // Common UI state
  // -----------------------
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

  // NEW fields (Create form)
  const [finNo, setFinNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(""); // yyyy-mm-dd

  const [workPermitNo, setWorkPermitNo] = useState("");
  const [workPermitExpiry, setWorkPermitExpiry] = useState(""); // yyyy-mm-dd

  const [bcssCsocNo, setBcssCsocNo] = useState("");
  const [csocExpiryDate, setCsocExpiryDate] = useState(""); // yyyy-mm-dd

  const [boomLiftExpiryDate, setBoomLiftExpiryDate] = useState(""); // yyyy-mm-dd
  const [scissorLiftExpiryDate, setScissorLiftExpiryDate] = useState(""); // yyyy-mm-dd

  const [showMoreFields, setShowMoreFields] = useState(false);

  // Create login user (existing)
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
      const data = await listEmployees(true); // includeInactive=true (if supported)
      setRows(Array.isArray(data) ? data : []);
    } catch {
      // fallback: if listEmployees(true) is not supported, use old call
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
      const d = String(e?.department || "").toLowerCase();
      const id = String(e?.id ?? "");
      const st = e?.active ? "active" : "inactive";

      const fin = String(e?.finNo || "").toLowerCase();
      const nat = String(e?.nationality || "").toLowerCase();
      const wp = String(e?.workPermitNo || "").toLowerCase();
      const csoc = String(e?.bcssCsocNo || "").toLowerCase();

      return (
        n.includes(s) ||
        d.includes(s) ||
        id.includes(s) ||
        st.includes(s) ||
        fin.includes(s) ||
        nat.includes(s) ||
        wp.includes(s) ||
        csoc.includes(s)
      );
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
        dateOfBirth: dateOfBirth || null,

        workPermitNo: emptyToNull(workPermitNo),
        workPermitExpiry: workPermitExpiry || null,

        bcssCsocNo: emptyToNull(bcssCsocNo),
        csocExpiryDate: csocExpiryDate || null,

        boomLiftExpiryDate: boomLiftExpiryDate || null,
        scissorLiftExpiryDate: scissorLiftExpiryDate || null,
      });

      // reset
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
    setEDepartment(emp?.department || "");
    setEActive(!!emp?.active);

    setEFinNo(emp?.finNo || "");
    setENationality(emp?.nationality || "");
    setEDob(emp?.dateOfBirth || "");

    setEWorkPermitNo(emp?.workPermitNo || "");
    setEWorkPermitExpiry(emp?.workPermitExpiry || "");

    setEBcssCsocNo(emp?.bcssCsocNo || "");
    setECsocExpiryDate(emp?.csocExpiryDate || "");

    setEBoomLiftExpiryDate(emp?.boomLiftExpiryDate || "");
    setEScissorLiftExpiryDate(emp?.scissorLiftExpiryDate || "");
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
        dateOfBirth: eDob || null,

        workPermitNo: eWorkPermitNo != null ? String(eWorkPermitNo) : null,
        workPermitExpiry: eWorkPermitExpiry || null,

        bcssCsocNo: eBcssCsocNo != null ? String(eBcssCsocNo) : null,
        csocExpiryDate: eCsocExpiryDate || null,

        boomLiftExpiryDate: eBoomLiftExpiryDate || null,
        scissorLiftExpiryDate: eScissorLiftExpiryDate || null,
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
      if (
        String(e?.message || "").includes("401") ||
        String(e?.message || "").includes("403")
      )
        onAuthError?.();
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
  // 4) LEAVE APPROVALS (Pending)
  // ============================================================
  const [pendingLeaves, setPendingLeaves] = useState([]);

  async function loadPendingLeaves() {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch(`${ENDPOINTS.leaveRequests}?status=Pending`, {
        method: "GET",
      });
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

  // -----------------------
  // Tab load triggers
  // -----------------------
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
          <div className="we-admin-sub">
            Manage employees • holidays • leave types • approvals
          </div>
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
        <button
          className={`we-tab ${tab === "employees" ? "on" : ""}`}
          onClick={() => setTab("employees")}
        >
          👷 Employees
        </button>
        <button
          className={`we-tab ${tab === "holidays" ? "on" : ""}`}
          onClick={() => setTab("holidays")}
        >
          🎌 Holidays
        </button>
        <button
          className={`we-tab ${tab === "leaveTypes" ? "on" : ""}`}
          onClick={() => setTab("leaveTypes")}
        >
          🧾 Leave Types
        </button>
        <button
          className={`we-tab ${tab === "approvals" ? "on" : ""}`}
          onClick={() => setTab("approvals")}
        >
          ✅ Leave Approvals
        </button>
      </div>

      {/* Message */}
      {msg ? (
        <div className={`we-admin-msg ${isSuccess ? "ok" : "bad"}`}>{msg}</div>
      ) : null}

      {/* EMPLOYEES TAB */}
      {tab === "employees" ? (
        <>
          <div className="we-admin-grid">
            {/* Create Login User */}
            <div className="we-admin-card">
              <div className="we-admin-cardTitle">
                Create Login (Username / Password)
              </div>

              <form onSubmit={onCreateLogin} className="we-admin-form">
                <label className="we-admin-label">
                  Employee
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">
                      👤
                    </span>
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
                    <span className="we-icon" aria-hidden="true">
                      ⌨️
                    </span>
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Username"
                    />
                  </div>
                </label>

                <label className="we-admin-label">
                  Password
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">
                      🔒
                    </span>
                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password"
                      type="password"
                    />
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
                    <span className="we-icon" aria-hidden="true">
                      🪪
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Employee name"
                    />
                  </div>
                </label>

                <label className="we-admin-label">
                  Department
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">
                      🏢
                    </span>
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Department (e.g. WE Engineering)"
                    />
                  </div>
                </label>

                <div className="we-admin-two">
                  <label className="we-admin-label">
                    Fin No.
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">
                        🪪
                      </span>
                      <input
                        value={finNo}
                        onChange={(e) => setFinNo(e.target.value)}
                        placeholder="Fin No."
                      />
                    </div>
                  </label>

                  <label className="we-admin-label">
                    Nationality
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">
                        🌍
                      </span>
                      <input
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="Nationality"
                      />
                    </div>
                  </label>
                </div>

                <label className="we-admin-label">
                  Date of Birth
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">
                      🎂
                    </span>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                </label>

                <label className="we-admin-check">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>

                <button
                  type="button"
                  className="we-btn-soft"
                  onClick={() => setShowMoreFields((v) => !v)}
                  disabled={loading}
                >
                  {showMoreFields
                    ? "Hide permit/cert fields"
                    : "Show permit/cert fields"}
                </button>

                {showMoreFields ? (
                  <div className="we-admin-more">
                    <div className="we-admin-two">
                      <label className="we-admin-label">
                        Work Permit No.
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">
                            🧾
                          </span>
                          <input
                            value={workPermitNo}
                            onChange={(e) => setWorkPermitNo(e.target.value)}
                            placeholder="Work Permit No."
                          />
                        </div>
                      </label>

                      <label className="we-admin-label">
                        Work Permit Expiry
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">
                            📅
                          </span>
                          <input
                            type="date"
                            value={workPermitExpiry}
                            onChange={(e) =>
                              setWorkPermitExpiry(e.target.value)
                            }
                          />
                        </div>
                      </label>
                    </div>

                    <div className="we-admin-two">
                      <label className="we-admin-label">
                        BCSS / CSOC No.
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">
                            🪪
                          </span>
                          <input
                            value={bcssCsocNo}
                            onChange={(e) => setBcssCsocNo(e.target.value)}
                            placeholder="BCSS / CSOC No."
                          />
                        </div>
                      </label>

                      <label className="we-admin-label">
                        CSOC Expiry Date
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">
                            📅
                          </span>
                          <input
                            type="date"
                            value={csocExpiryDate}
                            onChange={(e) => setCsocExpiryDate(e.target.value)}
                          />
                        </div>
                      </label>
                    </div>

                    <div className="we-admin-two">
                      <label className="we-admin-label">
                        Boom Lift Expiry Date
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">
                            🏗️
                          </span>
                          <input
                            type="date"
                            value={boomLiftExpiryDate}
                            onChange={(e) =>
                              setBoomLiftExpiryDate(e.target.value)
                            }
                          />
                        </div>
                      </label>

                      <label className="we-admin-label">
                        Scissor Lift Expiry Date
                        <div className="we-input">
                          <span className="we-icon" aria-hidden="true">
                            🪜
                          </span>
                          <input
                            type="date"
                            value={scissorLiftExpiryDate}
                            onChange={(e) =>
                              setScissorLiftExpiryDate(e.target.value)
                            }
                          />
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

          {/* List */}
          <div className="we-admin-card">
            <div className="we-admin-listHead">
              <div className="we-admin-cardTitle">
                Employees ({filteredRows.length})
              </div>
              <span className="we-admin-hint">
                Search: name / dept / id / fin / nationality / permit / csoc
              </span>
            </div>

            <div className="we-admin-searchRow">
              <div className="we-input">
                <span className="we-icon" aria-hidden="true">
                  🔎
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search employees..."
                />
              </div>
            </div>

            <div className="we-admin-list">
              {filteredRows.length === 0 ? (
                <div className="we-admin-empty">
                  {loading ? "Loading…" : "No employees yet."}
                </div>
              ) : (
                filteredRows.map((e) => (
                  <div key={e.id} className="we-admin-row">
                    <div className="we-admin-rowTop">
                      <div className="we-admin-name">
                        {e.name || "(no name)"}{" "}
                        <span className="we-admin-id">#{e.id}</span>
                      </div>

                      <div className="we-admin-actions">
                        <div
                          className={`we-admin-pill ${e.active ? "ok" : "bad"}`}
                        >
                          {e.active ? "ACTIVE" : "INACTIVE"}
                        </div>
                        <button
                          className="we-btn-mini"
                          onClick={() => openEdit(e)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="we-admin-meta">
                      <span className="we-admin-muted">
                        {e.department || "-"}
                      </span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>FIN:</b> {e.finNo || "—"}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>Nation:</b> {e.nationality || "—"}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>DOB:</b> {fmtDateOnly(e.dateOfBirth)}
                      </span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>WP No:</b> {e.workPermitNo || "—"}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>WP Exp:</b> {fmtDateOnly(e.workPermitExpiry)}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>CSOC:</b> {e.bcssCsocNo || "—"}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>CSOC Exp:</b> {fmtDateOnly(e.csocExpiryDate)}
                      </span>
                    </div>

                    <div className="we-admin-meta2">
                      <span>
                        <b>Boom Lift:</b> {fmtDateOnly(e.boomLiftExpiryDate)}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>
                        <b>Scissor Lift:</b>{" "}
                        {fmtDateOnly(e.scissorLiftExpiryDate)}
                      </span>
                      <span className="we-admin-dot">•</span>
                      <span>Created: {fmtDateTime(e.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---- Edit Modal ---- */}
          {editOpen ? (
            <div
              className="we-modalBack"
              role="dialog"
              aria-modal="true"
              onMouseDown={closeEdit}
            >
              <div
                className="we-modal"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="we-modalHead">
                  <div>
                    <div className="we-modalTitle">Edit employee</div>
                    <div className="we-modalSub">
                      ID #{editRow?.id} • Created{" "}
                      {fmtDateTime(editRow?.createdAt)}
                    </div>
                  </div>
                  <button
                    className="we-btn-x"
                    onClick={closeEdit}
                    disabled={editSaving}
                  >
                    ✕
                  </button>
                </div>

                <div className="we-modalBody">
                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Name
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🪪
                        </span>
                        <input
                          value={eName}
                          onChange={(ev) => setEName(ev.target.value)}
                        />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Department
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🏢
                        </span>
                        <input
                          value={eDepartment}
                          onChange={(ev) => setEDepartment(ev.target.value)}
                        />
                      </div>
                    </label>
                  </div>

                  <label className="we-admin-check">
                    <input
                      type="checkbox"
                      checked={eActive}
                      onChange={(ev) => setEActive(ev.target.checked)}
                    />
                    Active
                  </label>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Fin No.
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🪪
                        </span>
                        <input
                          value={eFinNo}
                          onChange={(ev) => setEFinNo(ev.target.value)}
                        />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Nationality
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🌍
                        </span>
                        <input
                          value={eNationality}
                          onChange={(ev) => setENationality(ev.target.value)}
                        />
                      </div>
                    </label>
                  </div>

                  <label className="we-admin-label">
                    Date of Birth
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">
                        🎂
                      </span>
                      <input
                        type="date"
                        value={eDob}
                        onChange={(ev) => setEDob(ev.target.value)}
                      />
                    </div>
                  </label>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Work Permit No.
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🧾
                        </span>
                        <input
                          value={eWorkPermitNo}
                          onChange={(ev) => setEWorkPermitNo(ev.target.value)}
                        />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Work Permit Expiry
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          📅
                        </span>
                        <input
                          type="date"
                          value={eWorkPermitExpiry}
                          onChange={(ev) =>
                            setEWorkPermitExpiry(ev.target.value)
                          }
                        />
                      </div>
                    </label>
                  </div>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      BCSS / CSOC No.
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🪪
                        </span>
                        <input
                          value={eBcssCsocNo}
                          onChange={(ev) => setEBcssCsocNo(ev.target.value)}
                        />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      CSOC Expiry Date
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          📅
                        </span>
                        <input
                          type="date"
                          value={eCsocExpiryDate}
                          onChange={(ev) => setECsocExpiryDate(ev.target.value)}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="we-admin-two">
                    <label className="we-admin-label">
                      Boom Lift Expiry Date
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🏗️
                        </span>
                        <input
                          type="date"
                          value={eBoomLiftExpiryDate}
                          onChange={(ev) =>
                            setEBoomLiftExpiryDate(ev.target.value)
                          }
                        />
                      </div>
                    </label>

                    <label className="we-admin-label">
                      Scissor Lift Expiry Date
                      <div className="we-input">
                        <span className="we-icon" aria-hidden="true">
                          🪜
                        </span>
                        <input
                          type="date"
                          value={eScissorLiftExpiryDate}
                          onChange={(ev) =>
                            setEScissorLiftExpiryDate(ev.target.value)
                          }
                        />
                      </div>
                    </label>
                  </div>

                  {editErr ? (
                    <div className="we-admin-msg bad">{editErr}</div>
                  ) : null}
                </div>

                <div className="we-modalFoot">
                  <button
                    className="we-btn-soft"
                    onClick={closeEdit}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="we-btn"
                    onClick={saveEdit}
                    disabled={editSaving}
                  >
                    {editSaving ? (
                      <span className="we-btn-spin">
                        <span className="spinner" />
                        Saving…
                      </span>
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

      {/* HOLIDAYS TAB */}
      {tab === "holidays" ? (
        <>
          <div className="we-admin-card">
            <div className="we-admin-cardTitle">Create Public Holiday</div>
            <form onSubmit={addHoliday} className="we-admin-form">
              <label className="we-admin-label">
                Date
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">
                    📅
                  </span>
                  <input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                  />
                </div>
              </label>

              <label className="we-admin-label">
                Name
                <div className="we-input">
                  <span className="we-icon" aria-hidden="true">
                    🏷️
                  </span>
                  <input
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="e.g. New Year"
                  />
                </div>
              </label>

              <button className="we-btn" disabled={loading}>
                {loading ? "Saving…" : "Add Holiday"}
              </button>
            </form>
          </div>

          <div className="we-admin-card">
            <div className="we-admin-listHead">
              <div className="we-admin-cardTitle">
                Holidays ({holidays.length})
              </div>
              <span className="we-admin-hint">
                Used to compute PH work / leave
              </span>
            </div>

            <div className="we-admin-list">
              {holidays.length === 0 ? (
                <div className="we-admin-empty">
                  {loading ? "Loading…" : "No holidays yet."}
                </div>
              ) : (
                holidays
                  .slice()
                  .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                  .map((h) => (
                    <div key={h.id} className="we-admin-row">
                      <div className="we-admin-rowTop">
                        <div className="we-admin-name">
                          {h.name || "(no name)"}
                        </div>
                        <button
                          className="we-btn-soft"
                          onClick={() => deleteHoliday(h.id)}
                          disabled={loading}
                        >
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
                  <span className="we-icon" aria-hidden="true">
                    🧾
                  </span>
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
                  <span className="we-icon" aria-hidden="true">
                    🏷️
                  </span>
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
              <div className="we-admin-cardTitle">
                Leave Types ({leaveTypes.length})
              </div>
              <span className="we-admin-hint">MC / AL / etc</span>
            </div>

            <div className="we-admin-list">
              {leaveTypes.length === 0 ? (
                <div className="we-admin-empty">
                  {loading ? "Loading…" : "No leave types yet."}
                </div>
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
              <div className="we-admin-empty">
                {loading ? "Loading…" : "No pending leave."}
              </div>
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
                      Type:{" "}
                      {r.leaveType?.code || r.leaveTypeCode || r.leaveTypeId}
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

      <style>{css}</style>
    </div>
  );
}

const css = `
.we-admin-page{ display:grid; gap:12px; color:#e5e7eb; }

/* Header */
.we-admin-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.we-admin-kicker{ font-size:12px; opacity:.75; }
.we-admin-title{ margin-top:2px; font-size:24px; font-weight:950; color:#fff; line-height:1.1; }
.we-admin-sub{ margin-top:6px; font-size:12px; color: rgba(226,232,240,.75); }
.we-admin-refresh{ width:auto; }

/* Tabs */
.we-admin-tabs{ display:flex; gap:10px; flex-wrap: wrap; }
.we-tab{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  border-radius:999px;
  padding:10px 12px;
  transition: background .12s ease, transform .12s ease, opacity .12s ease;
}
.we-tab:hover{ background: rgba(255,255,255,.14); transform: translateY(-1px); }
.we-tab.on{
  background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1));
  border-color: rgba(255,255,255,.18);
}

/* Message */
.we-admin-msg{
  border-radius:16px;
  padding:10px 12px;
  font-size:12px;
  font-weight:900;
  word-break: break-word;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.08);
}
.we-admin-msg.ok{
  border-color: rgba(34,197,94,.28);
  background: rgba(34,197,94,.14);
  color:#bbf7d0;
}
.we-admin-msg.bad{
  border-color: rgba(244,63,94,.28);
  background: rgba(244,63,94,.14);
  color:#fecdd3;
}

/* Layout */
.we-admin-grid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
.we-admin-two{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
.we-admin-more{ display:grid; gap:12px; }

/* Glass card */
.we-admin-card{
  background: rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14);
  border-radius:20px;
  padding:14px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 18px 48px rgba(0,0,0,.35);
}
.we-admin-cardTitle{ font-weight:950; color:#fff; margin-bottom:10px; }

/* Form */
.we-admin-form{ display:grid; gap:12px; }
.we-admin-label{ font-size:12px; font-weight:800; opacity:.9; display:grid; gap:8px; }

/* Inputs */
.we-input{
  display:flex; align-items:center; gap:10px;
  padding:12px 12px; border-radius:14px;
  background: rgba(15,23,42,.35);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
}
.we-icon{ opacity:.85; font-size:16px; }
.we-input input{
  width:100%; border:0; outline:none;
  background:transparent; color:#fff; font-size:14px;
}
.we-input input::placeholder{ color: rgba(226,232,240,.55); }

.we-admin-select{
  width:100%;
  border:0;
  outline:none;
  background:transparent;
  color:#fff;
  font-size:14px;
  appearance:none;
}
.we-admin-select option{ color:#0f172a; }

.we-admin-check{
  display:flex; align-items:center; gap:10px;
  font-size:12px; opacity:.9; user-select:none;
}
.we-admin-check input{ width:16px;height:16px; accent-color: #a5b4fc; }

/* Buttons */
.we-btn{
  border:0; border-radius:14px; padding:12px 14px;
  background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1));
  color:#fff; font-weight:900; font-size:14px;
  cursor:pointer; box-shadow: 0 14px 34px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .12s ease, opacity .12s ease;
}
.we-btn:hover{ filter: brightness(1.05); transform: translateY(-1px); }
.we-btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; }
.we-btn.danger{
  background: linear-gradient(135deg, rgba(244,63,94,1), rgba(236,72,153,1));
}

.we-btn-soft{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  transition: background .12s ease, opacity .12s ease;
  border-radius:14px;
  padding:10px 12px;
}
.we-btn-soft:hover{ background: rgba(255,255,255,.14); }
.we-btn-soft:disabled{ opacity:.55; cursor:not-allowed; }

.we-btn-mini{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  border-radius:999px;
  padding:8px 10px;
  font-size:12px;
}
.we-btn-mini:hover{ background: rgba(255,255,255,.14); }
.we-btn-mini:disabled{ opacity:.55; cursor:not-allowed; }

.we-btn-spin{ display:flex; align-items:center; justify-content:center; gap:10px; }
.spinner{
  width:16px;height:16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.5);
  border-top-color:#fff;
  animation:spin .9s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg);} }

/* List */
.we-admin-listHead{
  display:flex; align-items:baseline; justify-content:space-between;
  gap:10px; margin-bottom:10px;
}
.we-admin-hint{ font-size:12px; opacity:.75; white-space:nowrap; }
.we-admin-searchRow{ margin-bottom:12px; }

.we-admin-list{ display:grid; gap:10px; }
.we-admin-empty{ font-size:13px; opacity:.8; }

/* Row */
.we-admin-row{
  padding:12px; border-radius:18px;
  background: rgba(15,23,42,.22);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  display:grid; gap:8px;
}
.we-admin-rowTop{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.we-admin-name{
  font-weight:950; color:#fff; font-size:14px;
  min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.we-admin-id{ opacity:.75; font-weight:900; margin-left: 6px; }

.we-admin-actions{ display:flex; align-items:center; gap:10px; }

.we-admin-pill{
  font-size:12px; font-weight:950; padding:6px 10px;
  border-radius:999px; white-space:nowrap;
  border:1px solid rgba(255,255,255,.16);
}
.we-admin-pill.ok{
  background: rgba(34,197,94,.16);
  border-color: rgba(34,197,94,.28);
  color:#bbf7d0;
}
.we-admin-pill.bad{
  background: rgba(244,63,94,.14);
  border-color: rgba(244,63,94,.28);
  color:#fecdd3;
}

.we-admin-meta{ font-size:12px; color: rgba(226,232,240,.9); }
.we-admin-muted{ opacity:.9; }
.we-admin-meta2{
  font-size:12px; color: rgba(226,232,240,.75);
  display:flex; flex-wrap:wrap; gap:8px;
}
.we-admin-dot{ opacity:.6; }

.we-approveBtns{ display:flex; gap:10px; align-items:center; }
.we-approveBtns .we-btn{ padding:10px 12px; border-radius:12px; font-size:13px; }

/* Modal */
.we-modalBack{
  position:fixed; inset:0; z-index:999;
  background: rgba(0,0,0,.55);
  display:flex; align-items:center; justify-content:center;
  padding: 18px;
}
.we-modal{
  width: min(760px, 96vw);
  max-height: 92vh;
  overflow:auto;
  background: rgba(15,23,42,.95);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 18px;
  box-shadow: 0 30px 90px rgba(0,0,0,.55);
  padding: 14px;
}
.we-modalHead{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.we-modalTitle{ font-weight:950; font-size:16px; color:#fff; }
.we-modalSub{ font-size:12px; opacity:.75; margin-top:4px; }
.we-btn-x{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.08);
  color:#fff;
  border-radius: 12px;
  padding: 8px 10px;
  cursor:pointer;
}
.we-btn-x:hover{ background: rgba(255,255,255,.12); }
.we-modalBody{ margin-top: 12px; display:grid; gap:12px; }
.we-modalFoot{ margin-top: 14px; display:flex; justify-content:flex-end; gap:10px; }

/* Mobile */
@media (max-width: 720px){
  .we-admin-grid{ grid-template-columns: 1fr; }
  .we-admin-two{ grid-template-columns: 1fr; }
  .we-admin-head{ flex-direction: column; align-items: stretch; }
  .we-admin-refresh{ width:100%; }
  .we-admin-hint{ white-space:normal; }
  .we-approveBtns{ flex-direction: column; align-items: stretch; }
}
`;
