import React, { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export function ClockScreen({ onAuthError }) {
  const [open, setOpen] = useState(null);
  const [recent, setRecent] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    try {
      const o = await attendanceApi.open();
      setOpen(o);
      const rows = await attendanceApi.me();
      setRecent((rows || []).slice(0, 8));
    } catch (e) {
      if (e.status === 401) return onAuthError();
      setErr(e.message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkIn() {
    setBusy(true);
    setErr("");
    try {
      await attendanceApi.checkIn(note);
      setNote("");
      await refresh();
    } catch (e) {
      if (e.status === 401) return onAuthError();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setBusy(true);
    setErr("");
    try {
      await attendanceApi.checkOut();
      await refresh();
    } catch (e) {
      if (e.status === 401) return onAuthError();
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Status</div>
            <div style={{ fontSize: 18, fontWeight: 950 }}>
              {open ? "Checked in" : "Not checked in"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {open ? `Since ${fmtDateTime(open.checkInAt)}` : "Tap check in to start"}
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: 999,
              background: open ? "#dcfce7" : "#ffe4e6",
              color: open ? "#166534" : "#9f1239",
              fontSize: 12,
              fontWeight: 900,
              height: "fit-content",
            }}
          >
            {open ? "OPEN" : "OFF"}
          </div>
        </div>

        <div style={{ height: 12 }} />

        {!open ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>
                Note (optional)
              </div>
              <input
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.14)",
                }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Site visit"
                disabled={busy}
              />
            </div>
            <button
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                border: 0,
                background: "#0f172a",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              disabled={busy}
              onClick={checkIn}
            >
              {busy ? "Checking in…" : "Check in"}
            </button>
          </div>
        ) : (
          <button
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 16,
              border: 0,
              background: "#e11d48",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
            disabled={busy}
            onClick={checkOut}
          >
            {busy ? "Checking out…" : "Check out"}
          </button>
        )}

        {err ? (
          <div
            style={{
              marginTop: 10,
              color: "#be123c",
              fontWeight: 800,
              fontSize: 13,
              background: "#ffe4e6",
              border: "1px solid #fecdd3",
              padding: 10,
              borderRadius: 14,
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ marginTop: 10 }}>
          <button
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 16,
              border: 0,
              background: "#eef2ff",
              fontWeight: 900,
              cursor: "pointer",
            }}
            onClick={refresh}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 950 }}>Recent</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>Latest 8 records</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {recent.length === 0 ? (
            <div style={{ fontSize: 12, color: "#475569" }}>No records yet.</div>
          ) : (
            recent.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.10)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>#{r.id}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>{r.note || ""}</div>
                </div>
                <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    In: {fmtDateTime(r.checkInAt)}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Out: {fmtDateTime(r.checkOutAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}