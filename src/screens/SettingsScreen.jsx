// src/screens/SettingsScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import { leaveApi } from "../api/leave";
import { apiFetch } from "../api/client";

const REQUIRED_ATTACH_CODES = new Set(["MC", "HL"]);
const MAX_LEAVE_ATTACHMENT_BYTES = 2_000_000;
const ALLOWED_LEAVE_ATTACHMENT_EXT = new Set(["pdf", "jpg", "jpeg", "png"]);

export function SettingsScreen({ user }) {
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const [settingsTab, setSettingsTab] = useState(() => (isAdmin ? "account" : "leave"));

  const [types, setTypes] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveErr, setLeaveErr] = useState("");

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);

  // admin approvals
  const [lrBusy, setLrBusy] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [lrStatus, setLrStatus] = useState("Pending");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState(null);

  useEffect(() => {
    setSettingsTab(isAdmin ? "account" : "leave");
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (isAdmin) {
          setTypes([]);
          setMyLeaves([]);
          return;
        }
        const [t, m] = await Promise.all([leaveApi.types(), leaveApi.myLeaves()]);
        if (!active) return;
        setTypes(Array.isArray(t) ? t : []);
        setMyLeaves(Array.isArray(m) ? m : []);
      } catch (e) {
        if (!active) return;
        setLeaveErr(e?.message || "Failed to load leave data");
      }
    }
    load();
    return () => { active = false; };
  }, [isAdmin]);

  const selectedType = useMemo(
    () => types.find((t) => String(t.id) === String(leaveTypeId)) || null,
    [types, leaveTypeId]
  );
  const requiresAttachment = useMemo(() => {
    const code = selectedType?.code || "";
    return REQUIRED_ATTACH_CODES.has(String(code).toUpperCase());
  }, [selectedType]);

  async function reloadLeaves() {
    const m = await leaveApi.myLeaves();
    setMyLeaves(Array.isArray(m) ? m : []);
  }

  async function applyLeave(e) {
    e.preventDefault();
    setLeaveErr("");
    if (!leaveTypeId) return setLeaveErr("Please select leave type.");
    if (!startDate || !endDate) return setLeaveErr("Please select start/end date.");
    if (requiresAttachment && !file) return setLeaveErr("Attachment required for this leave type.");
    if (file && file.size > MAX_LEAVE_ATTACHMENT_BYTES) {
      return setLeaveErr("Attachment too large. Max 2MB.");
    }
    if (file) {
      const ext = String(file.name || "").split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_LEAVE_ATTACHMENT_EXT.has(ext)) {
        return setLeaveErr("Unsupported attachment type. Use PDF/JPG/PNG.");
      }
    }

    setLeaveBusy(true);
    try {
      if (file) {
        await leaveApi.applyWithFile({
          leaveTypeId: Number(leaveTypeId),
          startDate,
          endDate,
          reason,
          file,
        });
      } else {
        await leaveApi.apply({
          leaveTypeId: Number(leaveTypeId),
          startDate,
          endDate,
          reason,
        });
      }

      setReason("");
      setFile(null);
      await reloadLeaves();
    } catch (e2) {
      setLeaveErr(e2?.message || "Failed to apply leave");
    } finally {
      setLeaveBusy(false);
    }
  }

  async function cancelLeave(id) {
    setLeaveErr("");
    setLeaveBusy(true);
    try {
      await leaveApi.cancel(id);
      await reloadLeaves();
    } catch (e2) {
      setLeaveErr(e2?.message || "Failed to cancel leave");
    } finally {
      setLeaveBusy(false);
    }
  }

  async function downloadLeaveAttachmentCommon(id, onNotFoundReload) {
    setLeaveErr("");
    try {
      const { blob, contentDisposition } = await leaveApi.downloadAttachment(id);
      const nameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition || "");
      const name = nameMatch?.[1] || `leave_${id}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e2) {
      const msg = e2?.message || "Failed to download attachment";
      setLeaveErr(msg);
      if (String(msg).toLowerCase().includes("not found")) {
        await onNotFoundReload?.();
      }
    }
  }

  async function loadLeaveRequests() {
    setLeaveErr("");
    setLrBusy(true);
    try {
      const status = lrStatus === "All" ? "" : lrStatus;
      const data = await apiFetch(
        status ? `/api/LeaveRequests?status=${encodeURIComponent(status)}` : `/api/LeaveRequests`,
        { method: "GET", auth: true }
      );
      setLeaveRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load leave requests";
      setLeaveErr(msg);
    } finally {
      setLrBusy(false);
    }
  }

  async function approveLeave(id) {
    if (!id) return;
    setLeaveErr("");
    setLrBusy(true);
    try {
      await apiFetch(`/api/LeaveRequests/${id}/approve`, { method: "POST", auth: true, body: {} });
      await loadLeaveRequests();
    } catch (e) {
      const msg = e?.message || "Failed to approve leave";
      setLeaveErr(msg);
    } finally {
      setLrBusy(false);
    }
  }

  async function rejectLeave(id) {
    if (!id) return;
    setLeaveErr("");
    setLrBusy(true);
    try {
      await apiFetch(`/api/LeaveRequests/${id}/reject`, {
        method: "POST",
        auth: true,
        body: { reason: (rejectReason || "").trim() },
      });
      setRejectReason("");
      setRejectingId(null);
      await loadLeaveRequests();
    } catch (e) {
      const msg = e?.message || "Failed to reject leave";
      setLeaveErr(msg);
    } finally {
      setLrBusy(false);
    }
  }

  return (
    <div className="we-s-root">
      <div className="we-s-head">
        <div>
          <div className="we-s-kicker">Preferences</div>
          <div className="we-s-title">Settings</div>
          <div className="we-s-sub">Account and app info</div>
        </div>
      </div>

      <div className="we-glass-card">
        <div className="we-s-tabs">
          <button
            type="button"
            className={`we-s-tab ${settingsTab === "account" ? "is-active" : ""}`}
            onClick={() => setSettingsTab("account")}
          >
            Account
          </button>
          <button
            type="button"
            className={`we-s-tab ${settingsTab === "leave" ? "is-active" : ""}`}
            onClick={() => setSettingsTab("leave")}
          >
            {isAdmin ? "Leave Approvals" : "Leave"}
          </button>
        </div>
      </div>

      {settingsTab === "account" ? (
        <div className="we-glass-card">
          <div className="we-s-cardTitle">Account</div>
          <div className="we-s-cardSub">Signed in</div>

          <div className="we-s-list">
            <div className="we-s-row">
              <span className="we-s-key">Username</span>
              <span className="we-s-val">{user?.username || "—"}</span>
            </div>
            <div className="we-s-row">
              <span className="we-s-key">Role</span>
              <span className="we-s-val">{user?.role || "—"}</span>
            </div>
            <div className="we-s-row">
              <span className="we-s-key">EmployeeId</span>
              <span className="we-s-val">{user?.employeeId ?? "—"}</span>
            </div>
          </div>
        </div>
      ) : null}

      {settingsTab === "leave" && !isAdmin ? (
        <div className="we-s-grid">
          <div className="we-glass-card">
            <div className="we-s-cardTitle">Apply Leave</div>
            <div className="we-s-cardSub">Submit leave request with attachment (MC/HL required)</div>

            <form onSubmit={applyLeave} className="we-s-form we-s-form-grid2">
              <label className="we-s-label">
                Leave Type
                <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} disabled={leaveBusy}>
                  <option value="">Select type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                  ))}
                </select>
              </label>

              <label className="we-s-label">
                Start Date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={leaveBusy} />
              </label>

              <label className="we-s-label">
                End Date
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={leaveBusy} />
              </label>

              <label className="we-s-label we-s-span2">
                Reason (optional)
                <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={leaveBusy} placeholder="e.g. medical appointment" />
              </label>

              <label className="we-s-label we-s-span2">
                Attachment {requiresAttachment ? "(required)" : "(optional)"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={leaveBusy}
                />
              </label>

              <div className="we-s-hint we-s-span2">Max 2MB. Allowed: PDF, JPG, PNG. Stored on server at Documents/KJ_Attendance/leave_attachments.</div>

              <button className="we-s-apply we-s-span2" type="submit" disabled={leaveBusy}>
                {leaveBusy ? "Submitting…" : "Apply Leave"}
              </button>
            </form>

            {leaveErr ? <div className="we-s-error">{leaveErr}</div> : null}
          </div>

          <div className="we-glass-card">
            <div className="we-s-cardTitle">My Leave Requests</div>
            <div className="we-s-cardSub">Recent requests and status</div>

            {myLeaves.length === 0 ? (
              <div className="we-s-empty">No leave requests yet.</div>
            ) : (
              <div className="we-s-leaveList">
                {myLeaves.map((r) => (
                  <div key={r.id} className="we-s-leaveItem">
                    <div className="we-s-leaveTop">
                      <div className="we-s-leaveType">{r.leaveType?.code || r.leaveTypeId} • {r.leaveType?.name || ""}</div>
                      <span className="we-s-pill">{r.status || "Pending"}</span>
                    </div>
                    <div className="we-s-leaveMeta">{String(r.startDate)} → {String(r.endDate)}</div>
                    {r.reason ? <div className="we-s-leaveReason">Reason: {r.reason}</div> : null}

                    <div className="we-s-leaveActions">
                      {r.hasAttachment ? (
                        <button type="button" className="we-s-btn" onClick={() => downloadLeaveAttachmentCommon(r.id, reloadLeaves)}>
                          Download attachment
                        </button>
                      ) : null}
                      {String(r.status || "Pending") === "Pending" ? (
                        <button type="button" className="we-s-btn danger" onClick={() => cancelLeave(r.id)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {settingsTab === "leave" && isAdmin ? (
        <div className="we-glass-card">
          <div className="we-s-cardTitle">Leave Approvals</div>
          <div className="we-s-cardSub">Review and approve employee leave requests</div>

          <div className="we-approve-head">
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

          {leaveErr ? <div className="we-s-error">{leaveErr}</div> : null}

          {leaveRequests.length === 0 ? (
            <div className="we-s-empty">No requests.</div>
          ) : (
            <div className="we-s-leaveList">
              {leaveRequests.map((r) => {
                const empName = r?.employeeName || `Employee #${r?.employeeId ?? "?"}`;
                const lt = r?.leaveTypeCode
                  ? `${r.leaveTypeCode} - ${r.leaveTypeName ?? ""}`.trim()
                  : r?.leaveTypeName || `LeaveType #${r?.leaveTypeId ?? "?"}`;
                return (
                  <div key={r.id} className="we-s-leaveItem">
                    <div className="we-s-leaveTop">
                      <div className="we-s-leaveType">{empName}</div>
                      <span className="we-s-pill">{r.status || "Pending"}</span>
                    </div>
                    <div className="we-s-leaveMeta">{lt}</div>
                    <div className="we-s-leaveMeta">{String(r.startDate)} → {String(r.endDate)} • {r.days} days</div>
                    {r.reason ? <div className="we-s-leaveReason">Reason: {r.reason}</div> : null}

                    <div className="we-s-leaveActions">
                      {r.hasAttachment ? (
                        <button type="button" className="we-s-btn" onClick={() => downloadLeaveAttachmentCommon(r.id, loadLeaveRequests)}>
                          Download attachment
                        </button>
                      ) : null}

                      {String(r.status || "Pending") === "Pending" ? (
                        <>
                          <button className="we-s-btn" onClick={() => approveLeave(r.id)} disabled={lrBusy}>
                            Approve
                          </button>
                          <button className="we-s-btn danger" onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)} disabled={lrBusy}>
                            Reject
                          </button>
                        </>
                      ) : null}
                    </div>

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
                        <button className="we-btn danger" onClick={() => rejectLeave(r.id)} disabled={lrBusy}>
                          Confirm Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <style>{css}</style>
    </div>
  );
}

const css = `
.we-s-root{ display:grid; gap:12px; padding-bottom: 8px; }
.we-s-grid{ display:grid; gap:12px; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items:start; }
.we-s-kicker{ font-size:12px; opacity:.75; }
.we-s-title{ font-size:26px; font-weight:950; color:#fff; margin-top:2px; line-height:1.1; }
.we-s-sub{ margin-top:6px; font-size:12px; color: rgba(226,232,240,.75); }
.we-s-tabs{ display:flex; gap:8px; flex-wrap:wrap; }
.we-s-tab{
  border:1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.08);
  color:#fff;
  border-radius:var(--we-radius-pill);
  padding:8px 12px;
  font-size:12px;
  font-weight:900;
  cursor:pointer;
}
.we-s-tab.is-active{
  background: linear-gradient(135deg, rgba(99,102,241,.95), rgba(236,72,153,.9));
  border-color: rgba(255,255,255,.22);
}

.we-s-cardTitle{ font-weight:950; color:#fff; font-size:14px; }
.we-s-cardSub{ font-size:12px; color: rgba(226,232,240,.75); margin-top:2px; }

.we-s-list{ margin-top:12px; display:grid; gap:10px; }
.we-s-row{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:baseline;
  padding:10px 12px;
  border-radius:var(--we-radius-control);
  background: rgba(15,23,42,.22);
  border:1px solid rgba(255,255,255,.12);
}
.we-s-key{ font-size:12px; font-weight:900; color: rgba(226,232,240,.75); }
.we-s-val{
  font-size:12px;
  color: rgba(226,232,240,.92);
  text-align:right;
  word-break: break-word;
}

.we-s-logout{
  margin-top:14px;
  width:100%;
  border:0;
  border-radius:14px;
  padding:12px 14px;
  background: linear-gradient(135deg, rgba(244,63,94,1), rgba(236,72,153,1));
  color:#fff;
  font-weight:950;
  cursor:pointer;
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .12s ease;
}
.we-s-logout:hover{ filter: brightness(1.05); transform: translateY(-1px); }

.we-s-form{ margin-top:12px; display:grid; gap:10px; }
.we-s-form-grid2{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
.we-s-span2{ grid-column: 1 / -1; }
.we-s-label{ display:grid; gap:6px; font-size:12px; font-weight:900; opacity:.9; }
.we-s-form input, .we-s-form select{
  height:var(--we-control-h); border-radius:var(--we-radius-control); border:1px solid rgba(255,255,255,.14);
  background: rgba(15,23,42,.35); color:#fff; padding:0 10px;
}
.we-s-hint{ font-size:11px; opacity:.75; }
.we-s-apply{ border:0; border-radius:var(--we-radius-control); padding:12px 14px; background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1)); color:#fff; font-weight:950; cursor:pointer; }
.we-s-error{ margin-top:8px; padding:10px 12px; border-radius:12px; background: rgba(244,63,94,.14); border:1px solid rgba(244,63,94,.28); color:#fecdd3; font-size:12px; }

.we-s-empty{ font-size:12px; opacity:.75; margin-top:8px; }
.we-s-leaveList{ margin-top:12px; display:grid; gap:10px; }
.we-s-leaveItem{ padding:12px; border-radius:var(--we-radius-control); background: rgba(15,23,42,.22); border:1px solid rgba(255,255,255,.12); display:grid; gap:6px; }
.we-s-leaveTop{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.we-s-leaveType{ font-weight:900; color:#fff; font-size:13px; }
.we-s-pill{ padding:4px 8px; border-radius:var(--we-radius-pill); font-size:11px; font-weight:900; background: rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); }
.we-s-leaveMeta{ font-size:12px; opacity:.8; }
.we-s-leaveReason{ font-size:12px; opacity:.85; }
.we-s-leaveActions{ display:flex; gap:8px; flex-wrap:wrap; }
.we-s-btn{ border-radius:var(--we-radius-control); padding:8px 10px; border:1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.08); color:#fff; font-weight:900; cursor:pointer; }
.we-s-btn.danger{ background: rgba(244,63,94,.16); border-color: rgba(244,63,94,.28); color:#fecdd3; }

.we-approve-head{ display:flex; gap:10px; align-items:center; justify-content:flex-end; margin-top:8px; }
.we-select{ height:var(--we-control-h); border-radius:var(--we-radius-control); border:1px solid rgba(255,255,255,.14); background: rgba(15,23,42,.35); color:#fff; padding:0 10px; }
@media (max-width: 980px){
  .we-s-grid{ grid-template-columns: 1fr; }
}
@media (max-width: 720px){
  .we-s-form-grid2{ grid-template-columns: 1fr; }
  .we-approve-head{ justify-content:stretch; flex-wrap:wrap; }
  .we-approve-head .we-btn-soft,
  .we-approve-head .we-select{ width:100%; }
}
`;
