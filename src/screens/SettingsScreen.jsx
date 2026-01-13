import React from "react";
import { Card } from "../components/Card";
import { apiBase } from "../api/client";

export function SettingsScreen({ user, onLogout }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card>
        <div style={{ fontWeight: 950 }}>Account</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>Signed in</div>

        <div style={{ height: 10 }} />

        <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#475569" }}>
          <div><b>Username:</b> {user?.username || "—"}</div>
          <div><b>Role:</b> {user?.role || "—"}</div>
          <div><b>EmployeeId:</b> {user?.employeeId ?? "—"}</div>
          <div><b>API:</b> {apiBase()}</div>
        </div>

        <div style={{ height: 12 }} />

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
          onClick={onLogout}
        >
          Log out
        </button>
      </Card>
    </div>
  );
}