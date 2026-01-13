import { useEffect, useState } from "react";
import { createEmployee, listEmployees } from "../api/employees";

export default function AdminEmployees() {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [active, setActive] = useState(true);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    setLoading(true);
    setMsg("");
    try {
      const data = await listEmployees();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg(e.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setMsg("");

    if (!name.trim()) return setMsg("Name is required");
    if (!department.trim()) return setMsg("Department is required");

    setLoading(true);
    try {
      await createEmployee({ name: name.trim(), department: department.trim(), active });
      setName("");
      setDepartment("");
      setActive(true);
      await refresh();
      setMsg("✅ Employee created");
    } catch (e) {
      setMsg(e.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Admin • Employees</h2>

      {msg && (
        <div style={{
          padding: 10, borderRadius: 10, marginBottom: 12,
          background: msg.startsWith("✅") ? "#e8fff0" : "#ffecec"
        }}>
          {msg}
        </div>
      )}

      <form onSubmit={onCreate} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Employee name"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>

        <button
          disabled={loading}
          style={{
            padding: 12, borderRadius: 14, border: "none",
            background: "#0b132b", color: "white", fontWeight: 700
          }}
        >
          {loading ? "Saving..." : "Add Employee"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Employees</h3>
        <button onClick={refresh} disabled={loading} style={{ padding: "8px 12px", borderRadius: 12 }}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        {rows.length === 0 && <div style={{ opacity: 0.7 }}>No employees yet.</div>}

        {rows.map((e) => (
          <div key={e.id} style={{
            padding: 12, borderRadius: 14, border: "1px solid #eee",
            display: "flex", justifyContent: "space-between", gap: 10
          }}>
            <div>
              <div style={{ fontWeight: 800 }}>{e.name}</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>{e.department}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                ID: {e.id} • {e.active ? "Active" : "Inactive"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}