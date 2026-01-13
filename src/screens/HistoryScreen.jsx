import React, { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export function HistoryScreen({ onAuthError }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await attendanceApi.me();
      setRows(data || []);
    } catch (e) {
      if (e.status === 401) return onAuthError();
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 950 }}>My attendance</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Last records</div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              width: "auto",
              padding: "10px 12px",
              borderRadius: 999,
              border: 0,
              background: "#eef2ff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {err ? (
          <div style={{ marginTop: 10, color: "#be123c", fontWeight: 800, fontSize: 13, background: "#ffe4e6", border: "1px solid #fecdd3", padding: 10, borderRadius: 14 }}>
            {err}
          </div>
        ) : null}
      </Card>

      {rows.length === 0 ? (
        <Card>
          <div style={{ fontSize: 12, color: "#475569" }}>No records.</div>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>#{r.id}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{r.note || ""}</div>
            </div>
            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, color: "#475569" }}>In: {fmtDateTime(r.checkInAt)}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>Out: {fmtDateTime(r.checkOutAt)}</div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}