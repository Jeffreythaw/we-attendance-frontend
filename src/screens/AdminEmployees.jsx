import React, { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { listEmployees, createEmployee } from "../api/employees";
import { createEmployeeUser } from "../api/users";

export function AdminEmployees({ onAuthError }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // add employee
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  // create login for employee (optional)
  const [employeeId, setEmployeeId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function refresh() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const data = await listEmployees();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      const m = e?.message || "Failed to load employees";
      setErr(m);
      if (String(m).includes("401") || String(m).toLowerCase().includes("unauthorized")) {
        onAuthError?.();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onAddEmployee(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const created = await createEmployee({
        name: name.trim(),
        department: department.trim(),
      });
      setMsg(`Employee created (ID: ${created?.id ?? "OK"})`);
      setName("");
      setDepartment("");
      await refresh();
    } catch (e2) {
      const m = e2?.message || "Create employee failed";
      setErr(m);
      if (String(m).includes("401") || String(m).toLowerCase().includes("unauthorized")) {
        onAuthError?.();
      }
    }
  }

  async function onCreateUser(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const created = await createEmployeeUser({
        employeeId: Number(employeeId),
        username: username.trim(),
        password,
      });
      setMsg(`Login created: ${created?.username ?? "OK"}`);
      setEmployeeId("");
      setUsername("");
      setPassword("");
    } catch (e2) {
      const m = e2?.message || "Create user failed";
      setErr(m);
      if (String(m).includes("401") || String(m).toLowerCase().includes("unauthorized")) {
        onAuthError?.();
      }
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Admin • Employees</div>

      {err ? (
        <div
          style={{
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

      {msg ? (
        <div
          style={{
            color: "#065f46",
            fontWeight: 800,
            fontSize: 13,
            background: "#dcfce7",
            border: "1px solid #86efac",
            padding: 10,
            borderRadius: 14,
          }}
        >
          {msg}
        </div>
      ) : null}

      <Card>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Add Employee</div>
        <form onSubmit={onAddEmployee} style={{ display: "grid", gap: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.14)",
            }}
          />
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Department (e.g. WE Engineering)"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.14)",
            }}
          />
          <button
            type="submit"
            disabled={!name.trim() || !department.trim()}
            style={{
              padding: 12,
              borderRadius: 14,
              border: 0,
              background: "#0f172a",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Create Employee
          </button>
        </form>
      </Card>

      <Card>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Create Employee Login (Optional)
        </div>
        <form onSubmit={onCreateUser} style={{ display: "grid", gap: 10 }}>
          <input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="EmployeeId (e.g. 3)"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.14)",
            }}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.14)",
            }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.14)",
            }}
          />
          <button
            type="submit"
            disabled={!employeeId || !username.trim() || !password}
            style={{
              padding: 12,
              borderRadius: 14,
              border: 0,
              background: "#0f172a",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Create User
          </button>
        </form>
      </Card>

      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>Employees</div>
          <button
            onClick={refresh}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          {loading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ color: "#64748b" }}>No employees.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "white",
                  }}
                >
                  <div style={{ fontWeight: 950 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    ID: {r.id} • {r.department} •{" "}
                    {r.active ? "Active" : "Inactive"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}