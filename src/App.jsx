import React, { useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./screens/Login";
import { ClockScreen } from "./screens/ClockScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AdminEmployees } from "./screens/AdminEmployees";
import { Tabs } from "./components/Tabs";

export default function App() {
  const { user, isAuthed, login, logout } = useAuth();
  const [tab, setTab] = useState("clock");

  const showAdmin = useMemo(
    () => (user?.role || "").toLowerCase() === "admin",
    [user]
  );

  function onAuthError() {
    alert("Session expired. Please login again.");
    logout();
  }

  if (!isAuthed) {
    return <Login onLogin={login} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", paddingBottom: 82 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "#0f172a" }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>WE Attendance</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {user?.username} • {user?.role}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              border: 0,
              background: "#e2e8f0",
              color: "#0f172a",
              borderRadius: 999,
              padding: "10px 12px",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            Logout
          </button>
        </div>

        {tab === "clock" && <ClockScreen onAuthError={onAuthError} />}
        {tab === "history" && <HistoryScreen onAuthError={onAuthError} />}
        {tab === "admin" && showAdmin && <AdminEmployees onAuthError={onAuthError} />}
        {tab === "settings" && <SettingsScreen user={user} onLogout={logout} />}
      </div>

      <Tabs tab={tab} setTab={setTab} showAdmin={showAdmin} />
    </div>
  );
}