// src/screens/AdminScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { createEmployee, listEmployees } from "../api/employees";
import { apiFetch, apiFetchBlob } from "../api/client";

/**
 * ✅ Update these paths to match your backend controllers if needed.
 * Keep everything centralized here.
 */
const API = {
  usersCreate: "/api/Users",

  holidaysList: "/api/Holidays",
  holidaysCreate: "/api/Holidays",
  holidaysDelete: (id) => `/api/Holidays/${id}`,

  leaveTypesList: "/api/LeaveTypes",
  leaveTypesCreate: "/api/LeaveTypes",
  leaveTypesUpdate: (id) => `/api/LeaveTypes/${id}`,
  leaveTypesDelete: (id) => `/api/LeaveTypes/${id}`,

  // Common patterns — adjust to your LeaveController
  leaveRequestsList: (status) =>
    status ? `/api/LeaveRequests?status=${encodeURIComponent(status)}` : `/api/LeaveRequests`,
  leaveRequestsApprove: (id) => `/api/LeaveRequests/${id}/approve`,
  leaveRequestsReject: (id) => `/api/LeaveRequests/${id}/reject`,

  // Optional (if you implement later)
  leaveBalances: (year) => `/api/Leave/balances?year=${encodeURIComponent(year)}`,

  quotationInvoicesList: "/api/QuotationInvoices",
  quotationInvoicesCreate: "/api/QuotationInvoices",
  quotationInvoicesUpdate: (id) => `/api/QuotationInvoices/${id}`,
};

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function fmtDateOnly(v) {
  if (!v) return "—";
  // DateOnly usually comes as "YYYY-MM-DD"
  return String(v);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
}

function daysInclusive(startStr, endStr) {
  // startStr/endStr like "YYYY-MM-DD"
  try {
    const s = new Date(`${startStr}T00:00:00Z`);
    const e = new Date(`${endStr}T00:00:00Z`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    const ms = e.getTime() - s.getTime();
    const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
    return days > 0 ? days : 0;
  } catch {
    return null;
  }
}

export function AdminScreen({ onAuthError }) {
  const [tab, setTab] = useState("employees"); // employees | holidays | leaveTypes | leaveRequests | balances

  // shared error
  const [err, setErr] = useState("");

  // ============ Employees ============
  const [emps, setEmps] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // create employee
  const [fullName, setFullName] = useState("");
  const [dept, setDept] = useState("");
  const [creatingEmp, setCreatingEmp] = useState(false);

  // create user
  const [employeeId, setEmployeeId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // list controls
  const [includeInactive, setIncludeInactive] = useState(false);
  const [q, setQ] = useState("");

  async function loadEmployees() {
    setErr("");
    setLoadingList(true);
    try {
      const data = await listEmployees(includeInactive);
      setEmps(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load employees";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLoadingList(false);
    }
  }

  const filteredEmps = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return emps;

    return emps.filter((e) => {
      const name = String(e?.name ?? "").toLowerCase();
      const dep = String(e?.department ?? "").toLowerCase();
      const id = String(e?.id ?? "");
      return name.includes(s) || dep.includes(s) || id.includes(s);
    });
  }, [emps, q]);

  async function onCreateEmployee(e) {
    e.preventDefault();
    setErr("");

    const name = fullName.trim();
    const department = dept.trim();

    if (!name) return setErr("Name is required.");

    setCreatingEmp(true);
    try {
      await createEmployee({ name, department });
      setFullName("");
      setDept("");
      await loadEmployees();
    } catch (e2) {
      const msg = e2?.message || "Failed to create employee";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setCreatingEmp(false);
    }
  }

  async function onCreateUser(e) {
    e.preventDefault();
    setErr("");

    const empIdNum = Number(employeeId);
    if (!empIdNum || empIdNum <= 0) return setErr("EmployeeId must be a number (e.g. 3).");
    if (!username.trim() || !password) return setErr("Username and password are required.");

    setCreatingUser(true);
    try {
      await apiFetch(API.usersCreate, {
        method: "POST",
        auth: true,
        body: { employeeId: empIdNum, username: username.trim(), password },
      });

      setEmployeeId("");
      setUsername("");
      setPassword("");
    } catch (e2) {
      const msg = e2?.message || "Failed to create user";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setCreatingUser(false);
    }
  }

  // ============ Holidays ============
  const [holidays, setHolidays] = useState([]);
  const [holBusy, setHolBusy] = useState(false);
  const [holDate, setHolDate] = useState(""); // YYYY-MM-DD
  const [holName, setHolName] = useState("");

  async function loadHolidays() {
    setErr("");
    setHolBusy(true);
    try {
      const data = await apiFetch(API.holidaysList, { method: "GET", auth: true });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load holidays";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setHolBusy(false);
    }
  }

  async function createHoliday(e) {
    e.preventDefault();
    setErr("");
    if (!holDate) return setErr("Holiday date is required.");
    if (!holName.trim()) return setErr("Holiday name is required.");

    setHolBusy(true);
    try {
      await apiFetch(API.holidaysCreate, {
        method: "POST",
        auth: true,
        body: { date: holDate, name: holName.trim() },
      });
      setHolDate("");
      setHolName("");
      await loadHolidays();
    } catch (e) {
      const msg = e?.message || "Failed to create holiday";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setHolBusy(false);
    }
  }

  async function deleteHoliday(id) {
    if (!id) return;
    setErr("");
    setHolBusy(true);
    try {
      await apiFetch(API.holidaysDelete(id), { method: "DELETE", auth: true });
      await loadHolidays();
    } catch (e) {
      const msg = e?.message || "Failed to delete holiday";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setHolBusy(false);
    }
  }

  const sortedHolidays = useMemo(() => {
    const rows = [...(holidays || [])];
    rows.sort((a, b) => String(a?.date ?? "").localeCompare(String(b?.date ?? "")));
    return rows;
  }, [holidays]);

  // ============ Leave Types ============
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [ltBusy, setLtBusy] = useState(false);

  const [ltCode, setLtCode] = useState("");
  const [ltName, setLtName] = useState("");
  const [ltPaid, setLtPaid] = useState(true);
  const [ltActive, setLtActive] = useState(true);

  async function loadLeaveTypes() {
    setErr("");
    setLtBusy(true);
    try {
      const data = await apiFetch(API.leaveTypesList, { method: "GET", auth: true });
      setLeaveTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load leave types";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLtBusy(false);
    }
  }

  async function createLeaveType(e) {
    e.preventDefault();
    setErr("");

    const code = ltCode.trim().toUpperCase();
    const name = ltName.trim();
    if (!code) return setErr("Leave type code is required (e.g. AL, MC).");
    if (!name) return setErr("Leave type name is required.");

    setLtBusy(true);
    try {
      await apiFetch(API.leaveTypesCreate, {
        method: "POST",
        auth: true,
        body: { code, name, paid: !!ltPaid, active: !!ltActive },
      });
      setLtCode("");
      setLtName("");
      setLtPaid(true);
      setLtActive(true);
      await loadLeaveTypes();
    } catch (e) {
      const msg = e?.message || "Failed to create leave type";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLtBusy(false);
    }
  }

  async function updateLeaveType(id, patch) {
    if (!id) return;
    setErr("");
    setLtBusy(true);
    try {
      await apiFetch(API.leaveTypesUpdate(id), {
        method: "PUT",
        auth: true,
        body: patch,
      });
      await loadLeaveTypes();
    } catch (e) {
      const msg = e?.message || "Failed to update leave type";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLtBusy(false);
    }
  }

  async function deleteLeaveType(id) {
    if (!id) return;
    setErr("");
    setLtBusy(true);
    try {
      await apiFetch(API.leaveTypesDelete(id), { method: "DELETE", auth: true });
      await loadLeaveTypes();
    } catch (e) {
      const msg = e?.message || "Failed to delete leave type";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLtBusy(false);
    }
  }

  const sortedLeaveTypes = useMemo(() => {
    const rows = [...(leaveTypes || [])];
    rows.sort((a, b) => String(a?.code ?? "").localeCompare(String(b?.code ?? "")));
    return rows;
  }, [leaveTypes]);

  // ============ Leave Requests ============
  const [lrBusy, setLrBusy] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [lrStatus, setLrStatus] = useState("Pending"); // Pending | Approved | Rejected | Cancelled | All
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);

  async function loadLeaveRequests() {
    setErr("");
    setLrBusy(true);
    try {
      const status = lrStatus === "All" ? "" : lrStatus;
      const data = await apiFetch(API.leaveRequestsList(status), { method: "GET", auth: true });
      setLeaveRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load leave requests";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLrBusy(false);
    }
  }

  async function approveLeave(id) {
    if (!id) return;
    setErr("");
    setLrBusy(true);
    try {
      await apiFetch(API.leaveRequestsApprove(id), { method: "POST", auth: true, body: {} });
      await loadLeaveRequests();
    } catch (e) {
      const msg = e?.message || "Failed to approve leave";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLrBusy(false);
    }
  }

  async function rejectLeave(id) {
    if (!id) return;
    setErr("");
    setLrBusy(true);
    try {
      await apiFetch(API.leaveRequestsReject(id), {
        method: "POST",
        auth: true,
        body: { reason: (rejectReason || "").trim() },
      });
      setRejectReason("");
      setRejectingId(null);
      await loadLeaveRequests();
    } catch (e) {
      const msg = e?.message || "Failed to reject leave";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setLrBusy(false);
    }
  }

  const sortedLeaveRequests = useMemo(() => {
    const rows = [...(leaveRequests || [])];
    rows.sort((a, b) => {
      const da = String(a?.createdAt ?? a?.id ?? "");
      const db = String(b?.createdAt ?? b?.id ?? "");
      return db.localeCompare(da);
    });
    return rows;
  }, [leaveRequests]);

  // ============ Leave Balances (Optional) ============
  const [balYear, setBalYear] = useState(String(new Date().getFullYear()));
  const [balBusy, setBalBusy] = useState(false);
  const [balances, setBalances] = useState(null); // could be array or object
  const [balNote, setBalNote] = useState("");

  // ============ Quotations & Invoices ============
  const [qiBusy, setQiBusy] = useState(false);
  const [quotationInvoices, setQuotationInvoices] = useState([]);
  const [qiSearch, setQiSearch] = useState("");

  const [qiQuotRef, setQiQuotRef] = useState("");
  const [qiLocation, setQiLocation] = useState("");
  const [qiDescription, setQiDescription] = useState("");
  const [qiTotalBeforeGst, setQiTotalBeforeGst] = useState("");
  const [qiQuotStatus, setQiQuotStatus] = useState("Pending");
  const [qiWorkStatus, setQiWorkStatus] = useState("Scheduling");
  const [qiInvoiceStatus, setQiInvoiceStatus] = useState("Pending due to Svc report");
  const [qiInvoiceDate, setQiInvoiceDate] = useState("");
  const [qiInvoiceRef, setQiInvoiceRef] = useState("");
  const [qiPaymentStatus, setQiPaymentStatus] = useState("Pending");
  const [qiReceivedDate, setQiReceivedDate] = useState("");
  const [qiFilterQuotStatus, setQiFilterQuotStatus] = useState("All");
  const [qiFilterWorkStatus, setQiFilterWorkStatus] = useState("All");
  const [qiFilterInvoiceStatus, setQiFilterInvoiceStatus] = useState("All");
  const [qiFilterPaymentStatus, setQiFilterPaymentStatus] = useState("All");
  const [qiFilterLocation, setQiFilterLocation] = useState("");
  const [qiFilterFrom, setQiFilterFrom] = useState("");
  const [qiFilterTo, setQiFilterTo] = useState("");
  const [qiReportMonth, setQiReportMonth] = useState("");

  async function loadBalances() {
    setErr("");
    setBalNote("");
    setBalBusy(true);
    try {
      const y = clamp(Number(balYear) || new Date().getFullYear(), 2000, 2100);
      const data = await apiFetch(API.leaveBalances(y), { method: "GET", auth: true });
      setBalances(data);
    } catch (e) {
      // If endpoint not exist, show a friendly message
      setBalances(null);
      setBalNote("Leave balances endpoint not available yet (add /api/Leave/balances on backend).");
      const msg = e?.message || "Failed to load leave balances";
      // Don’t hard-fail admin page for optional feature; keep msg in note
      if (String(msg).includes("404")) {
        setBalNote("Leave balances endpoint not available yet (backend returned 404).");
      } else {
        setBalNote(msg);
      }
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setBalBusy(false);
    }
  }

    async function loadQuotationInvoices() {
    setErr("");
    setQiBusy(true);
    try {
      const data = await apiFetch(API.quotationInvoicesList, { method: "GET", auth: true });
      setQuotationInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load quotation/invoice records";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setQiBusy(false);
    }
  }

  async function createQuotationInvoice(e) {
    e.preventDefault();
    setErr("");
    setQiBusy(true);
    try {
      const body = {
        quotRef: qiQuotRef || null,
        location: qiLocation || null,
        description: qiDescription || null,
        totalBeforeGst: Number(qiTotalBeforeGst || 0),
        quotStatus: qiQuotStatus,
        workStatus: qiWorkStatus,
        invoiceStatus: qiInvoiceStatus,
        invoiceDate: qiInvoiceDate || null,
        invoiceRef: qiInvoiceRef || null,
        paymentStatus: qiPaymentStatus,
        receivedDate: qiReceivedDate || null,
      };
      await apiFetch(API.quotationInvoicesCreate, { method: "POST", auth: true, body });
      setQiQuotRef("");
      setQiLocation("");
      setQiDescription("");
      setQiTotalBeforeGst("");
      setQiInvoiceDate("");
      setQiInvoiceRef("");
      setQiReceivedDate("");
      await loadQuotationInvoices();
    } catch (e) {
      const msg = e?.message || "Failed to create record";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setQiBusy(false);
    }
  }

  async function downloadQuotationReport(format) {
    if (!qiReportMonth) {
      setErr("Please select report month.");
      return;
    }
    const url = `/api/QuotationInvoices/report?month=${encodeURIComponent(qiReportMonth)}&format=${encodeURIComponent(format)}`;
    if (format === "html") {
      window.open(url, "_blank");
      return;
    }
    const { blob, contentDisposition } = await apiFetchBlob(url, { method: "GET", auth: true });
    const nameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition || "");
    const name = nameMatch?.[1] || `quotation-invoice-${qiReportMonth}.csv`;
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dlUrl);
  }

  async function updateQuotationInvoice(id, patch) {
    if (!id) return;
    setErr("");
    setQiBusy(true);
    try {
      await apiFetch(API.quotationInvoicesUpdate(id), { method: "PUT", auth: true, body: patch });
      await loadQuotationInvoices();
    } catch (e) {
      const msg = e?.message || "Failed to update record";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setQiBusy(false);
    }
  }

// ============ Tab loading triggers ============
  useEffect(() => {
    // load only what’s needed when switching tabs
    if (tab === "employees") loadEmployees();
    if (tab === "holidays") loadHolidays();
    if (tab === "leaveTypes") loadLeaveTypes();
    if (tab === "leaveRequests") loadLeaveRequests();
    if (tab === "balances") loadBalances();
    if (tab === "quotes") loadQuotationInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Also reload leave requests when filter changes
  useEffect(() => {
    if (tab === "leaveRequests") loadLeaveRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lrStatus]);

  return (
    <div className="we-a-root">
      {/* background */}
      <div className="we-a-bg" aria-hidden="true">
        <div className="we-a-blob we-a-blob-1" />
        <div className="we-a-blob we-a-blob-2" />
        <div className="we-a-blob we-a-blob-3" />
        <div className="we-a-noise" />
      </div>

      <div className="we-a-wrap">
        {/* header */}
        <div className="we-a-head">
          <div>
            <div className="we-a-kicker">Administration</div>
            <div className="we-a-title">Admin Console</div>
            <div className="we-a-sub">Employees • Holidays • Leave • Approvals</div>
          </div>
          <span className="we-a-pill">ADMIN</span>
        </div>

        {/* tabs */}
        <div className="we-tabs">
          <button className={`we-tab ${tab === "employees" ? "active" : ""}`} onClick={() => setTab("employees")}>
            Employees
          </button>
          <button className={`we-tab ${tab === "holidays" ? "active" : ""}`} onClick={() => setTab("holidays")}>
            Holidays
          </button>
          <button className={`we-tab ${tab === "leaveTypes" ? "active" : ""}`} onClick={() => setTab("leaveTypes")}>
            Leave Types
          </button>
          <button className={`we-tab ${tab === "leaveRequests" ? "active" : ""}`} onClick={() => setTab("leaveRequests")}>
            Leave Requests
          </button>
          <button className={`we-tab ${tab === "balances" ? "active" : ""}`} onClick={() => setTab("balances")}>
            Balances
          </button>
          <button className={`we-tab ${tab === "quotes" ? "active" : ""}`} onClick={() => setTab("quotes")}>
            Quotations
          </button>
        </div>

        {err ? <div className="we-error">{err}</div> : null}

        {/* ========== TAB: EMPLOYEES ========== */}
        {tab === "employees" ? (
          <>
            <div className="we-a-grid2">
              {/* Create Employee */}
              <Card className="we-glass-card">
                <div className="we-a-cardHead">
                  <div className="we-a-cardTitle">Create Employee</div>
                  <div className="we-a-cardMeta">Add staff profile</div>
                </div>

                <form onSubmit={onCreateEmployee} className="we-a-form">
                  <label className="we-a-label">
                    Full name
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">👤</span>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Jeffrey Ko"
                        disabled={creatingEmp}
                      />
                    </div>
                  </label>

                  <label className="we-a-label">
                    Department
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">🏢</span>
                      <input
                        value={dept}
                        onChange={(e) => setDept(e.target.value)}
                        placeholder="e.g. WE Engineering"
                        disabled={creatingEmp}
                      />
                    </div>
                  </label>

                  <button className="we-btn" type="submit" disabled={creatingEmp}>
                    {creatingEmp ? (
                      <span className="we-btn-spin">
                        <span className="spinner" />
                        Creating…
                      </span>
                    ) : (
                      "Create Employee"
                    )}
                  </button>
                </form>
              </Card>

              {/* Create User */}
              <Card className="we-glass-card">
                <div className="we-a-cardHead">
                  <div className="we-a-cardTitle">Create Login User</div>
                  <div className="we-a-cardMeta">Bind to employee ID</div>
                </div>

                <form onSubmit={onCreateUser} className="we-a-form">
                  <label className="we-a-label">
                    EmployeeId
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">#️⃣</span>
                      <input
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="e.g. 3"
                        inputMode="numeric"
                        disabled={creatingUser}
                      />
                    </div>
                  </label>

                  <label className="we-a-label">
                    Username
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">⌨️</span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. raj"
                        disabled={creatingUser}
                      />
                    </div>
                  </label>

                  <label className="we-a-label">
                    Password
                    <div className="we-input">
                      <span className="we-icon" aria-hidden="true">🔒</span>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        placeholder="••••••••"
                        disabled={creatingUser}
                      />
                    </div>
                  </label>

                  <button className="we-btn" type="submit" disabled={creatingUser}>
                    {creatingUser ? (
                      <span className="we-btn-spin">
                        <span className="spinner" />
                        Creating…
                      </span>
                    ) : (
                      "Create User"
                    )}
                  </button>
                </form>
              </Card>
            </div>

            {/* Employees list */}
            <Card className="we-glass-card">
              <div className="we-a-listHead">
                <div>
                  <div className="we-a-cardTitle">Employees</div>
                  <div className="we-a-cardMeta">{filteredEmps.length} results</div>
                </div>

                <button className="we-btn-soft" onClick={loadEmployees} disabled={loadingList}>
                  {loadingList ? "Loading…" : "Refresh"}
                </button>
              </div>

              <div className="we-a-form" style={{ marginTop: 10 }}>
                <label className="we-a-label">
                  Search
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🔎</span>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search by name / dept / id"
                    />
                  </div>
                </label>

                <label className="we-a-check">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                  />
                  Include inactive employees
                </label>
              </div>

              {filteredEmps.length === 0 ? (
                <div className="we-a-empty">No employees found.</div>
              ) : (
                <div className="we-a-list">
                  {filteredEmps.map((e) => (
                    <div key={e.id} className="we-a-item">
                      <div className="we-a-itemTop">
                        <div className="we-a-name">{e.name || "(no name)"}</div>
                        <span className={`we-a-state ${e.active ? "active" : "inactive"}`}>
                          {e.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      <div className="we-a-meta">
                        <span className="we-a-muted">Dept:</span> {e.department || "-"}{" "}
                        <span className="we-a-dot">•</span>
                        <span className="we-a-muted">ID:</span> {e.id}
                      </div>

                      <div className="we-a-date">Created: {fmtDateTime(e.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : null}

        {/* ========== TAB: HOLIDAYS ========== */}
        {tab === "holidays" ? (
          <div className="we-a-grid2">
            <Card className="we-glass-card">
              <div className="we-a-cardHead">
                <div className="we-a-cardTitle">Create Holiday</div>
                <div className="we-a-cardMeta">Public holiday setup</div>
              </div>

              <form onSubmit={createHoliday} className="we-a-form">
                <label className="we-a-label">
                  Date
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">📅</span>
                    <input
                      type="date"
                      value={holDate}
                      onChange={(e) => setHolDate(e.target.value)}
                      disabled={holBusy}
                    />
                  </div>
                </label>

                <label className="we-a-label">
                  Name
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🏷️</span>
                    <input
                      value={holName}
                      onChange={(e) => setHolName(e.target.value)}
                      placeholder="e.g. Chinese New Year"
                      disabled={holBusy}
                    />
                  </div>
                </label>

                <button className="we-btn" type="submit" disabled={holBusy}>
                  {holBusy ? (
                    <span className="we-btn-spin"><span className="spinner" /> Saving…</span>
                  ) : (
                    "Add Holiday"
                  )}
                </button>

                <button className="we-btn-soft" type="button" onClick={loadHolidays} disabled={holBusy}>
                  Refresh
                </button>
              </form>
            </Card>

            <Card className="we-glass-card">
              <div className="we-a-cardHead">
                <div className="we-a-cardTitle">Holiday List</div>
                <div className="we-a-cardMeta">{sortedHolidays.length} items</div>
              </div>

              {sortedHolidays.length === 0 ? (
                <div className="we-a-empty">No holidays yet.</div>
              ) : (
                <div className="we-a-list">
                  {sortedHolidays.map((h) => (
                    <div key={h.id} className="we-a-item">
                      <div className="we-a-itemTop">
                        <div className="we-a-name">{h.name || "(no name)"}</div>
                        <span className="we-a-state active">{fmtDateOnly(h.date)}</span>
                      </div>

                      <div className="we-a-actions">
                        <button
                          className="we-btn-soft danger"
                          onClick={() => deleteHoliday(h.id)}
                          disabled={holBusy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {/* ========== TAB: LEAVE TYPES ========== */}
        {tab === "leaveTypes" ? (
          <div className="we-a-grid2">
            <Card className="we-glass-card">
              <div className="we-a-cardHead">
                <div className="we-a-cardTitle">Create Leave Type</div>
                <div className="we-a-cardMeta">e.g. AL, MC, UPL</div>
              </div>

              <form onSubmit={createLeaveType} className="we-a-form">
                <label className="we-a-label">
                  Code
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🔤</span>
                    <input
                      value={ltCode}
                      onChange={(e) => setLtCode(e.target.value)}
                      placeholder="AL"
                      maxLength={10}
                      disabled={ltBusy}
                    />
                  </div>
                </label>

                <label className="we-a-label">
                  Name
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">📝</span>
                    <input
                      value={ltName}
                      onChange={(e) => setLtName(e.target.value)}
                      placeholder="Annual Leave"
                      disabled={ltBusy}
                    />
                  </div>
                </label>

                <label className="we-a-check">
                  <input type="checkbox" checked={ltPaid} onChange={(e) => setLtPaid(e.target.checked)} disabled={ltBusy} />
                  Paid leave
                </label>

                <label className="we-a-check">
                  <input type="checkbox" checked={ltActive} onChange={(e) => setLtActive(e.target.checked)} disabled={ltBusy} />
                  Active (available to select)
                </label>

                <button className="we-btn" type="submit" disabled={ltBusy}>
                  {ltBusy ? (
                    <span className="we-btn-spin"><span className="spinner" /> Saving…</span>
                  ) : (
                    "Add Leave Type"
                  )}
                </button>

                <button className="we-btn-soft" type="button" onClick={loadLeaveTypes} disabled={ltBusy}>
                  Refresh
                </button>
              </form>
            </Card>

            <Card className="we-glass-card">
              <div className="we-a-cardHead">
                <div className="we-a-cardTitle">Leave Types</div>
                <div className="we-a-cardMeta">{sortedLeaveTypes.length} items</div>
              </div>

              {sortedLeaveTypes.length === 0 ? (
                <div className="we-a-empty">No leave types yet.</div>
              ) : (
                <div className="we-a-list">
                  {sortedLeaveTypes.map((t) => (
                    <div key={t.id} className="we-a-item">
                      <div className="we-a-itemTop">
                        <div className="we-a-name">
                          <span className="we-badge">{t.code}</span> {t.name}
                        </div>
                        <span className={`we-a-state ${t.active ? "active" : "inactive"}`}>
                          {t.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      <div className="we-a-meta">
                        <span className="we-a-muted">Paid:</span> {t.paid ? "Yes" : "No"}{" "}
                        <span className="we-a-dot">•</span>
                        <span className="we-a-muted">ID:</span> {t.id}
                      </div>

                      <div className="we-a-actions">
                        <button
                          className="we-btn-soft"
                          onClick={() => updateLeaveType(t.id, { active: !t.active })}
                          disabled={ltBusy}
                        >
                          Toggle Active
                        </button>
                        <button
                          className="we-btn-soft"
                          onClick={() => updateLeaveType(t.id, { paid: !t.paid })}
                          disabled={ltBusy}
                        >
                          Toggle Paid
                        </button>
                        <button
                          className="we-btn-soft danger"
                          onClick={() => deleteLeaveType(t.id)}
                          disabled={ltBusy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {/* ========== TAB: LEAVE REQUESTS ========== */}
        {tab === "leaveRequests" ? (
          <Card className="we-glass-card">
            <div className="we-a-listHead">
              <div>
                <div className="we-a-cardTitle">Leave Requests</div>
                <div className="we-a-cardMeta">{sortedLeaveRequests.length} items</div>
              </div>

              <div className="we-inline">
                <select
                  className="we-select"
                  value={lrStatus}
                  onChange={(e) => setLrStatus(e.target.value)}
                  disabled={lrBusy}
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="All">All</option>
                </select>

                <button className="we-btn-soft" onClick={loadLeaveRequests} disabled={lrBusy}>
                  {lrBusy ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>

            {sortedLeaveRequests.length === 0 ? (
              <div className="we-a-empty">No requests.</div>
            ) : (
              <div className="we-a-list">
                {sortedLeaveRequests.map((r) => {
                  const empName = r?.employee?.name || r?.employeeName || `Employee #${r?.employeeId ?? "?"}`;
                  const lt = r?.leaveType?.code
                    ? `${r.leaveType.code} - ${r.leaveType.name ?? ""}`.trim()
                    : r?.leaveTypeName || r?.leaveTypeCode || `LeaveType #${r?.leaveTypeId ?? "?"}`;

                  const start = r?.startDate || r?.fromDate || r?.StartDate || r?.FromDate;
                  const end = r?.endDate || r?.toDate || r?.EndDate || r?.ToDate;
                  const days = start && end ? daysInclusive(String(start), String(end)) : null;

                  return (
                    <div key={r.id} className="we-a-item">
                      <div className="we-a-itemTop">
                        <div className="we-a-name">{empName}</div>
                        <span className={`we-a-state ${String(r.status || "Pending") === "Pending" ? "inactive" : "active"}`}>
                          {r.status || "Pending"}
                        </span>
                      </div>

                      <div className="we-a-meta">
                        <span className="we-a-muted">Type:</span> {lt}{" "}
                        <span className="we-a-dot">•</span>
                        <span className="we-a-muted">Dates:</span> {fmtDateOnly(start)} → {fmtDateOnly(end)}
                        {days != null ? (
                          <>
                            {" "}
                            <span className="we-a-dot">•</span>
                            <span className="we-a-muted">Days:</span> {days}
                          </>
                        ) : null}
                      </div>

                      {r.reason ? (
                        <div className="we-a-date" style={{ opacity: 0.9 }}>
                          <span className="we-a-muted">Reason:</span> {r.reason}
                        </div>
                      ) : null}

                      <div className="we-a-date">
                        Created: {fmtDateTime(r.createdAt)}
                        {r.approvedAt ? <>{" "}• Approved: {fmtDateTime(r.approvedAt)}</> : null}
                      </div>

                      {String(r.status || "Pending") === "Pending" ? (
                        <div className="we-a-actions">
                          <button className="we-btn-soft" onClick={() => approveLeave(r.id)} disabled={lrBusy}>
                            Approve
                          </button>

                          <button
                            className="we-btn-soft danger"
                            onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
                            disabled={lrBusy}
                          >
                            Reject
                          </button>

                          {rejectingId === r.id ? (
                            <div className="we-rejectBox">
                              <div className="we-input">
                                <span className="we-icon" aria-hidden="true">✍️</span>
                                <input
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="Optional reject reason"
                                  disabled={lrBusy}
                                />
                              </div>
                              <button
                                className="we-btn danger"
                                onClick={() => rejectLeave(r.id)}
                                disabled={lrBusy}
                              >
                                Confirm Reject
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : null}

        
        {/* ========== TAB: QUOTATIONS & INVOICES ========== */}
        {tab === "quotes" ? (
          <div className="we-a-grid2">
            <Card className="we-glass-card">
              <div className="we-a-cardHead">
                <div className="we-a-cardTitle">Create Record</div>
                <div className="we-a-cardMeta">Quotation & invoice tracking</div>
              </div>

              <form onSubmit={createQuotationInvoice} className="we-a-form">
                <label className="we-a-label">
                  Quot Ref
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">#️⃣</span>
                    <input value={qiQuotRef} onChange={(e) => setQiQuotRef(e.target.value)} placeholder="e.g. Q-2026-001" />
                  </div>
                </label>

                <label className="we-a-label">
                  Location
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">📍</span>
                    <input value={qiLocation} onChange={(e) => setQiLocation(e.target.value)} placeholder="Site / client" />
                  </div>
                </label>

                <label className="we-a-label">
                  Description
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🧾</span>
                    <input value={qiDescription} onChange={(e) => setQiDescription(e.target.value)} placeholder="Work scope" />
                  </div>
                </label>

                <label className="we-a-label">
                  TTL Amount bef GST
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">💰</span>
                    <input value={qiTotalBeforeGst} onChange={(e) => setQiTotalBeforeGst(e.target.value)} placeholder="0.00" inputMode="decimal" />
                  </div>
                </label>

                <label className="we-a-label">
                  Quot Status
                  <select className="we-select" value={qiQuotStatus} onChange={(e) => setQiQuotStatus(e.target.value)}>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Work Status
                  <select className="we-select" value={qiWorkStatus} onChange={(e) => setQiWorkStatus(e.target.value)}>
                    <option value="Completed">Completed</option>
                    <option value="Scheduling">Scheduling</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Invoice Status
                  <select className="we-select" value={qiInvoiceStatus} onChange={(e) => setQiInvoiceStatus(e.target.value)}>
                    <option value="Submitted">Submitted</option>
                    <option value="Pending due to Svc report">Pending due to Svc report</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Invoice Date
                  <input type="date" value={qiInvoiceDate} onChange={(e) => setQiInvoiceDate(e.target.value)} />
                </label>

                <label className="we-a-label">
                  Invoice Ref
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🧾</span>
                    <input value={qiInvoiceRef} onChange={(e) => setQiInvoiceRef(e.target.value)} placeholder="INV-2026-001" />
                  </div>
                </label>

                <label className="we-a-label">
                  Payment Status
                  <select className="we-select" value={qiPaymentStatus} onChange={(e) => setQiPaymentStatus(e.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="Received">Received</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Received Date
                  <input type="date" value={qiReceivedDate} onChange={(e) => setQiReceivedDate(e.target.value)} />
                </label>

                <button className="we-btn" type="submit" disabled={qiBusy}>
                  {qiBusy ? "Saving…" : "Create"}
                </button>
              </form>
            </Card>

            <Card className="we-glass-card">
              <div className="we-a-listHead">
                <div>
                  <div className="we-a-cardTitle">Quotation & Invoice Records</div>
                  <div className="we-a-cardMeta">{quotationInvoices.length} items</div>
                </div>

                <div className="we-inline">
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">🔎</span>
                    <input value={qiSearch} onChange={(e) => setQiSearch(e.target.value)} placeholder="Search ref / location / invoice" />
                  </div>

                  <button className="we-btn-soft" onClick={loadQuotationInvoices} disabled={qiBusy}>
                    {qiBusy ? "Loading…" : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="we-a-form" style={{ marginTop: 10 }}>
                <label className="we-a-label">
                  Location
                  <div className="we-input">
                    <span className="we-icon" aria-hidden="true">📍</span>
                    <input value={qiFilterLocation} onChange={(e) => setQiFilterLocation(e.target.value)} placeholder="Filter location" />
                  </div>
                </label>

                <label className="we-a-label">
                  Quot Status
                  <select className="we-select" value={qiFilterQuotStatus} onChange={(e) => setQiFilterQuotStatus(e.target.value)}>
                    <option value="All">All</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Work Status
                  <select className="we-select" value={qiFilterWorkStatus} onChange={(e) => setQiFilterWorkStatus(e.target.value)}>
                    <option value="All">All</option>
                    <option value="Completed">Completed</option>
                    <option value="Scheduling">Scheduling</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Invoice Status
                  <select className="we-select" value={qiFilterInvoiceStatus} onChange={(e) => setQiFilterInvoiceStatus(e.target.value)}>
                    <option value="All">All</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Pending due to Svc report">Pending due to Svc report</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Payment Status
                  <select className="we-select" value={qiFilterPaymentStatus} onChange={(e) => setQiFilterPaymentStatus(e.target.value)}>
                    <option value="All">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Received">Received</option>
                  </select>
                </label>

                <label className="we-a-label">
                  Invoice From
                  <input type="date" value={qiFilterFrom} onChange={(e) => setQiFilterFrom(e.target.value)} />
                </label>

                <label className="we-a-label">
                  Invoice To
                  <input type="date" value={qiFilterTo} onChange={(e) => setQiFilterTo(e.target.value)} />
                </label>
              </div>

              <div className="we-a-form" style={{ marginTop: 10 }}>
                <label className="we-a-label">
                  Report Month
                  <input type="month" value={qiReportMonth} onChange={(e) => setQiReportMonth(e.target.value)} />
                </label>
                <button className="we-btn-soft" type="button" onClick={() => downloadQuotationReport("csv")}>Download Excel (CSV)</button>
                <button className="we-btn-soft" type="button" onClick={() => downloadQuotationReport("html")}>Open PDF (Print)</button>
              </div>

              {quotationInvoices.length === 0 ? (
                <div className="we-a-empty">No records yet.</div>
              ) : (
                <div className="we-admin-tableWrap">
                  <table className="we-admin-table">
                    <thead>
                      <tr>
                        <th>Quot Ref</th>
                        <th>Location</th>
                        <th>Description</th>
                        <th>TTL Amount bef GST</th>
                        <th>Quot Status</th>
                        <th>Work Status</th>
                        <th>Invoice Status</th>
                        <th>Invoice Date</th>
                        <th>Invoice Ref</th>
                        <th>0-30 days</th>
                        <th>31-60 days</th>
                        <th>61+ days</th>
                        <th>TTL Due Amount</th>
                        <th>Payment Status</th>
                        <th>Received Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationInvoices
                        .filter((r) => {
                          const s = qiSearch.trim().toLowerCase();
                          if (s) {
                            if (!String(r.quotRef || "").toLowerCase().includes(s)
                              && !String(r.location || "").toLowerCase().includes(s)
                              && !String(r.invoiceRef || "").toLowerCase().includes(s)) return false;
                          }
                          if (qiFilterLocation && !String(r.location || "").toLowerCase().includes(qiFilterLocation.trim().toLowerCase())) return false;
                          if (qiFilterQuotStatus !== "All" && r.quotStatus !== qiFilterQuotStatus) return false;
                          if (qiFilterWorkStatus !== "All" && r.workStatus !== qiFilterWorkStatus) return false;
                          if (qiFilterInvoiceStatus !== "All" && r.invoiceStatus !== qiFilterInvoiceStatus) return false;
                          if (qiFilterPaymentStatus !== "All" && r.paymentStatus !== qiFilterPaymentStatus) return false;
                          if (qiFilterFrom && (!r.invoiceDate || r.invoiceDate < qiFilterFrom)) return false;
                          if (qiFilterTo && (!r.invoiceDate || r.invoiceDate > qiFilterTo)) return false;
                          return true;
                        })
                        .map((r) => {
                          const days = daysSince(r.invoiceDate);
                          const amt = Number(r.totalBeforeGst || 0);
                          const b0_30 = days != null && days >= 0 && days <= 30 ? amt : 0;
                          const b31_60 = days != null && days >= 31 && days <= 60 ? amt : 0;
                          const b61 = days != null && days >= 61 ? amt : 0;
                          const ttlDue = (r.paymentStatus === "Received") ? 0 : (b0_30 + b31_60 + b61);
                          return (
                            <tr key={r.id}>
                              <td>{r.quotRef || "—"}</td>
                              <td>{r.location || "—"}</td>
                              <td>{r.description || "—"}</td>
                              <td>{formatMoney(r.totalBeforeGst)}</td>
                              <td>
                                <select
                                  className="we-select"
                                  value={r.quotStatus || "Pending"}
                                  onChange={(e) => updateQuotationInvoice(r.id, { quotStatus: e.target.value })}
                                >
                                  <option value="Approved">Approved</option>
                                  <option value="Pending">Pending</option>
                                </select>
                              </td>
                              <td>
                                <select
                                  className="we-select"
                                  value={r.workStatus || "Scheduling"}
                                  onChange={(e) => updateQuotationInvoice(r.id, { workStatus: e.target.value })}
                                >
                                  <option value="Completed">Completed</option>
                                  <option value="Scheduling">Scheduling</option>
                                </select>
                              </td>
                              <td>
                                <select
                                  className="we-select"
                                  value={r.invoiceStatus || "Pending due to Svc report"}
                                  onChange={(e) => updateQuotationInvoice(r.id, { invoiceStatus: e.target.value })}
                                >
                                  <option value="Submitted">Submitted</option>
                                  <option value="Pending due to Svc report">Pending due to Svc report</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="date"
                                  value={r.invoiceDate || ""}
                                  onChange={(e) => updateQuotationInvoice(r.id, { invoiceDate: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  value={r.invoiceRef || ""}
                                  onChange={(e) => updateQuotationInvoice(r.id, { invoiceRef: e.target.value })}
                                  placeholder="Invoice ref"
                                />
                              </td>
                              <td>{formatMoney(b0_30)}</td>
                              <td>{formatMoney(b31_60)}</td>
                              <td>{formatMoney(b61)}</td>
                              <td>{formatMoney(ttlDue)}</td>
                              <td>
                                <select
                                  className="we-select"
                                  value={r.paymentStatus || "Pending"}
                                  onChange={(e) => updateQuotationInvoice(r.id, { paymentStatus: e.target.value })}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Received">Received</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="date"
                                  value={r.receivedDate || ""}
                                  onChange={(e) => updateQuotationInvoice(r.id, { receivedDate: e.target.value })}
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        ) : null}

{/* ========== TAB: BALANCES (OPTIONAL) ========== */}
        {tab === "balances" ? (
          <Card className="we-glass-card">
            <div className="we-a-listHead">
              <div>
                <div className="we-a-cardTitle">Leave Balances</div>
                <div className="we-a-cardMeta">Optional feature (backend endpoint required)</div>
              </div>

              <div className="we-inline">
                <div className="we-input" style={{ padding: "10px 12px" }}>
                  <span className="we-icon" aria-hidden="true">🗓️</span>
                  <input
                    value={balYear}
                    onChange={(e) => setBalYear(e.target.value)}
                    placeholder="Year (e.g. 2026)"
                    inputMode="numeric"
                    disabled={balBusy}
                  />
                </div>

                <button className="we-btn-soft" onClick={loadBalances} disabled={balBusy}>
                  {balBusy ? "Loading…" : "Load"}
                </button>
              </div>
            </div>

            {balNote ? <div className="we-a-empty">{balNote}</div> : null}

            {balances ? (
              <pre className="we-json">{JSON.stringify(balances, null, 2)}</pre>
            ) : (
              <div className="we-a-empty">
                If you want balances, we can implement backend endpoint: <br />
                <span className="we-mono">GET /api/Leave/balances?year=2026</span>
              </div>
            )}
          </Card>
        ) : null}
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
/* page */
.we-a-root{
  position:relative;
  overflow:hidden;
  padding: 8px 0 0;
  color:#e5e7eb;
}

/* background */
.we-a-bg{ position:fixed; inset:0; z-index:0; background:#0b1220; }
.we-a-blob{
  position:absolute;
  width:560px; height:560px;
  filter: blur(70px);
  opacity:.55;
  border-radius:999px;
}
.we-a-blob-1{ top:-220px; left:-220px; background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%); }
.we-a-blob-2{ bottom:-260px; right:-220px; background: radial-gradient(circle at 30% 30%, #22c55e, transparent 55%); }
.we-a-blob-3{ top:25%; right:-280px; background: radial-gradient(circle at 30% 30%, #06b6d4, transparent 55%); }
.we-a-noise{
  position:absolute; inset:0;
  opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

/* content */
.we-a-wrap{
  position:relative;
  z-index:1;
  display:grid;
  gap:12px;
}

/* header */
.we-a-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  padding: 6px 2px;
}
.we-a-kicker{ font-size:12px; opacity:.75; }
.we-a-title{ font-size:22px; font-weight:950; color:#fff; margin-top:2px; line-height:1.1; }
.we-a-sub{ font-size:12px; opacity:.78; margin-top:6px; }

.we-a-pill{
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
  white-space:nowrap;
}

/* tabs */
.we-tabs{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  padding: 2px;
}
.we-tab{
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color:#fff;
  border-radius:999px;
  padding:8px 12px;
  font-weight:900;
  font-size:12px;
  cursor:pointer;
  opacity:.85;
}
.we-tab:hover{ opacity:1; background: rgba(255,255,255,.09); }
.we-tab.active{
  opacity:1;
  background: rgba(99,102,241,.22);
  border-color: rgba(99,102,241,.35);
}

/* glass card */
.we-glass-card{
  background: rgba(255,255,255,.08) !important;
  border: 1px solid rgba(255,255,255,.16) !important;
  box-shadow: 0 30px 80px rgba(0,0,0,.35) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 18px !important;
}

/* reuse shared ui pieces */
.we-input{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 12px;
  border-radius:14px;
  background: rgba(15,23,42,.35);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
}
.we-input input, .we-input select{
  width:100%;
  border:0;
  outline:none;
  background:transparent;
  color:#fff;
  font-size:14px;
}
.we-input input::placeholder{ color: rgba(226,232,240,.55); }
.we-icon{ opacity:.85; font-size:16px; }

.we-inline{
  display:flex;
  gap:10px;
  align-items:center;
}

/* headings */
.we-a-cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  gap:10px;
  margin-bottom:10px;
}
.we-a-cardTitle{ font-size:14px; font-weight:950; color:#fff; }
.we-a-cardMeta{ font-size:12px; opacity:.75; }

/* forms */
.we-a-form{
  display:grid;
  gap:12px;
}
.we-a-label{
  font-size:12px;
  font-weight:800;
  opacity:.9;
  display:grid;
  gap:8px;
}
.we-a-check{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:12px;
  opacity:.9;
  user-select:none;
}
.we-a-check input{
  width:16px;
  height:16px;
  accent-color:#a5b4fc;
}

/* grid for create forms */
.we-a-grid2{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:12px;
}

/* list header */
.we-a-listHead{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}

/* list */
.we-a-empty{
  margin-top:12px;
  font-size:13px;
  opacity:.78;
}
.we-a-list{
  margin-top:12px;
  display:grid;
  gap:10px;
}
.we-a-item{
  padding:12px;
  border-radius:16px;
  background: rgba(15,23,42,.22);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  display:grid;
  gap:8px;
}
.we-a-itemTop{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:10px;
}
.we-a-name{
  font-weight:950;
  color:#fff;
  min-width:0;
}
.we-a-state{
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.16);
  white-space:nowrap;
}
.we-a-state.active{
  background: rgba(34,197,94,.16);
  border-color: rgba(34,197,94,.28);
  color:#bbf7d0;
}
.we-a-state.inactive{
  background: rgba(244,63,94,.14);
  border-color: rgba(244,63,94,.28);
  color:#fecdd3;
}

.we-a-meta{
  font-size:12px;
  color: rgba(226,232,240,.9);
}
.we-a-muted{ opacity:.75; font-weight:800; }
.we-a-dot{ opacity:.45; margin: 0 6px; }

.we-a-date{
  font-size:12px;
  opacity:.78;
}

.we-a-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:4px;
}

.we-rejectBox{
  display:grid;
  gap:10px;
  width:100%;
}

.we-badge{
  display:inline-block;
  font-size:11px;
  font-weight:950;
  padding:4px 8px;
  border-radius:999px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  margin-right:8px;
  opacity:.95;
}

.we-select{
  border-radius:14px;
  padding:10px 12px;
  border:1px solid rgba(255,255,255,.12);
  background: rgba(15,23,42,.35);
  color:#fff;
  font-weight:900;
}

.we-json{
  margin-top:12px;
  padding:12px;
  border-radius:14px;
  background: rgba(15,23,42,.32);
  border:1px solid rgba(255,255,255,.12);
  overflow:auto;
  max-height: 360px;
  font-size:12px;
  color: rgba(226,232,240,.9);
}
.we-mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* shared buttons (same as clock/login) */
.we-btn{
  width:100%;
  border:0;
  border-radius:14px;
  padding:12px 14px;
  background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1));
  color:#fff;
  font-weight:900;
  font-size:14px;
  cursor:pointer;
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .12s ease, opacity .12s ease;
}
.we-btn:hover{ filter: brightness(1.05); transform: translateY(-1px); }
.we-btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; }
.we-btn.danger{
  background: linear-gradient(135deg, rgba(244,63,94,1), rgba(236,72,153,1));
}

.we-btn-soft{
  border-radius:14px;
  padding:10px 14px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  transition: background .12s ease, opacity .12s ease;
}
.we-btn-soft:hover{ background: rgba(255,255,255,.14); }
.we-btn-soft:disabled{ opacity:.55; cursor:not-allowed; }
.we-btn-soft.danger{
  border-color: rgba(244,63,94,.28);
  background: rgba(244,63,94,.12);
}

.we-btn-spin{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
}
.spinner{
  width:16px;height:16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.5);
  border-top-color:#fff;
  animation:spin .9s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg);} }

/* error */
.we-error{
  background: rgba(244,63,94,.14);
  border:1px solid rgba(244,63,94,.28);
  color:#fecdd3;
  border-radius:16px;
  padding:10px 12px;
  font-size:12px;
  font-weight:800;
  word-break: break-word;
}

/* mobile */
@media (max-width: 860px){
  .we-a-grid2{
    grid-template-columns: 1fr;
  }
}
`;
