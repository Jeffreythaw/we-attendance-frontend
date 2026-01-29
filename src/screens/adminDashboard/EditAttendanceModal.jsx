import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { PATCH_LOG_ENDPOINT, DISPLAY_TZ, FIXED_OFFSET } from "./constants";
import { dateTimeLocalToOffsetString, isoToDateTimeLocal } from "./timezone";

export default function EditAttendanceModal({ open, row, onClose, onSaved, onAuthError }) {
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editClearOut, setEditClearOut] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setEditErr("");
    setEditCheckIn(isoToDateTimeLocal(row?.checkInAt));
    setEditCheckOut(isoToDateTimeLocal(row?.checkOutAt));
    setEditClearOut(!row?.checkOutAt);
    setEditNote(row?.note ?? "");
  }, [open, row]);

  if (!open) return null;

  async function saveEdit() {
    if (!row?.id) return;

    setEditSaving(true);
    setEditErr("");

    try {
      const payload = {
        checkInAt: dateTimeLocalToOffsetString(editCheckIn),
        checkOutAt: editClearOut ? null : dateTimeLocalToOffsetString(editCheckOut),
        clearCheckOut: !!editClearOut,
        note: editNote,
      };

      await apiFetch(PATCH_LOG_ENDPOINT(row.id), {
        method: "PATCH",
        auth: true,
        body: payload,
      });

      onSaved?.();
      onClose?.();
    } catch (e) {
      const msg = e?.message || "Failed to save changes";
      if (String(msg).includes("401") || String(msg).includes("403")) {
        onAuthError?.();
        return;
      }
      setEditErr(msg);
    } finally {
      setEditSaving(false);
    }
  }

  function close() {
    if (editSaving) return;
    onClose?.();
  }

  return (
    <div className="we-modalBack" role="dialog" aria-modal="true" onMouseDown={close}>
      <div className="we-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="we-modalHead">
          <div>
            <div className="we-modalTitle">Edit attendance</div>
            <div className="we-modalSub">
              Log #{row?.id} • Employee #{row?.employeeId}
            </div>
          </div>
          <button className="we-btn-x" onClick={close} disabled={editSaving} type="button">
            ✕
          </button>
        </div>

        <div className="we-modalBody">
          <label className="we-modalLabel">
            Check-in time
            <input
              type="datetime-local"
              value={editCheckIn}
              onChange={(e) => setEditCheckIn(e.target.value)}
              disabled={editSaving}
            />
          </label>

          <label className="we-modalLabel">
            Check-out time
            <input
              type="datetime-local"
              value={editCheckOut}
              onChange={(e) => setEditCheckOut(e.target.value)}
              disabled={editSaving || editClearOut}
            />
          </label>

          <label className="we-modalCheck">
            <input
              type="checkbox"
              checked={editClearOut}
              onChange={(e) => setEditClearOut(e.target.checked)}
              disabled={editSaving}
            />
            Clear check-out (set CheckOutAt = null)
          </label>

          <label className="we-modalLabel">
            Note
            <input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Optional note"
              disabled={editSaving}
            />
          </label>

          <div className="we-modalHint">
            Display TZ: <b>{DISPLAY_TZ || "Browser local"}</b>
            {FIXED_OFFSET ? (
              <>
                {" "}
                • Saving as <b>{FIXED_OFFSET}</b> offset
              </>
            ) : (
              <> • Saving using browser local → UTC</>
            )}
          </div>

          {editErr ? <div className="we-error">{editErr}</div> : null}
        </div>

        <div className="we-modalFoot">
          <button className="we-btn-soft" onClick={close} disabled={editSaving} type="button">
            Cancel
          </button>
          <button className="we-btn" onClick={saveEdit} disabled={editSaving} type="button">
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
  );
}