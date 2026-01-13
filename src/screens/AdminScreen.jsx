import React, { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { attendanceApi } from "../api/attendance";

export function AdminScreen({ onAuthError }) {
  const [rows, setRows] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const data = await attendanceApi.all();
      setRows(data || []);
    } catch (e) {
      if (e.status === 401) return onAuthError();
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadByEmployee() {
    if (!employeeId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await attendanceApi.byEmployee(Number(employeeId));
      setRows(data || []);
    } catch (e) {
      if (e.status === 401) return onAuthError();
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div style={{ fontWeight: 950 }}>Admin</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>View attendance logs</div>

        <div style={{ height: 10 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="EmployeeId"
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.14)",
            }}
          />
          <button
            onClick={loadByEmployee}
            disabled={loading || !employeeId}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: 0,
              background: "#0f172a",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Load
          </button>
        </div>

        <div style={{ height: 8 }} />

        <button
          onClick={loadAll}
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 16,
            border: 0,
            background: "#eef2ff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {loading ? "Loading…" : "Load all"}
        </button>

        {err ? (
          <div style={{ marginTop: 10, color: "#be123c", fontWeight: 800, fontSize: 13, background: "#ffe4e6", border: "1px solid #fecdd3", padding: 10, borderRadius: 14 }}>
            {err}
          </div>
        ) : null}
      </Card>

      <Card>
        <div style={{ fontWeight: 950 }}>Results</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{rows.length} rows</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {rows.slice(0, 30).map((r) => (
            <div key={r.id} style={{ padding: 10, borderRadius: 14, border: "1px solid rgba(15,23,42,0.10)" }}>
              <div style={{ fontWeight: 900 }}>#{r.id} • Emp {r.employeeId}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>In: {String(r.checkInAt || "—")}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>Out: {String(r.checkOutAt || "—")}</div>
              {r.note ? <div style={{ fontSize: 12, color: "#475569" }}>Note: {r.note}</div> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}