// src/App.jsx
import React, { useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./screens/Login";

import { ClockScreen } from "./screens/ClockScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

import AdminDashboard from "./screens/AdminDashboard";
import AdminEmployees from "./pages/AdminEmployees";

import { Tabs } from "./components/Tabs";

function AppBackground() {
  return (
    <div className="we-app-bg" aria-hidden="true">
      <div className="we-app-blob b1" />
      <div className="we-app-blob b2" />
      <div className="we-app-blob b3" />
      <div className="we-app-noise" />
      <style>{cssBg}</style>
    </div>
  );
}

function AuthedApp({ user, logout }) {
  const isAdmin = useMemo(() => (user?.role || "").toLowerCase() === "admin", [user]);

  const tabs = useMemo(() => {
    return isAdmin
      ? [
          { key: "dashboard", label: "Dashboard", icon: "📊" },
          { key: "employees", label: "Employees", icon: "🧑‍💼" },
          { key: "settings", label: "Settings", icon: "⚙️" },
        ]
      : [
          { key: "clock", label: "Clock", icon: "⏱️" },
          { key: "history", label: "History", icon: "📜" },
          { key: "settings", label: "Settings", icon: "⚙️" },
        ];
  }, [isAdmin]);

  const [tab, setTab] = useState(() => (isAdmin ? "dashboard" : "clock"));

  function onAuthError() {
    alert("Session expired. Please login again.");
    logout();
  }

  return (
    <div className="we-shell" style={{ paddingBottom: 92 }}>
      <AppBackground />

      <div className="we-container">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                background: "linear-gradient(135deg, rgba(99,102,241,0.85), rgba(236,72,153,0.75))",
                boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.18)",
                flex: "0 0 auto",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.1, color: "#fff" }}>
                WE Attendance
              </div>
              <div style={{ fontSize: 12 }} className="we-muted">
                {user?.username} • {user?.role}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="we-btn-soft"
            style={{ borderRadius: 999, padding: "10px 12px", fontWeight: 950, fontSize: 13 }}
          >
            Logout
          </button>
        </div>

        {/* Screens */}
        {!isAdmin && tab === "clock" && <ClockScreen onAuthError={onAuthError} />}
        {!isAdmin && tab === "history" && <HistoryScreen onAuthError={onAuthError} />}

        {isAdmin && tab === "dashboard" && <AdminDashboard onAuthError={onAuthError} />}
        {isAdmin && tab === "employees" && <AdminEmployees onAuthError={onAuthError} />}

        {tab === "settings" && (
          <SettingsScreen user={user} onLogout={logout} isAdmin={isAdmin} />
        )}
      </div>

      <Tabs tab={tab} setTab={setTab} items={tabs} />
    </div>
  );
}

export default function App() {
  const { user, isAuthed, login, logout } = useAuth();

  if (!isAuthed) return <Login onLogin={login} />;

  const sessionKey = `${user?.username || "u"}:${user?.role || "r"}`;
  return <AuthedApp key={sessionKey} user={user} logout={logout} />;
}

const cssBg = `
.we-app-bg{ position:fixed; inset:0; z-index:0; background:#0b1220; }
.we-shell{ position:relative; min-height:100vh; overflow:hidden; }
.we-container{
  position:relative;
  z-index:1;
  max-width: 860px;
  margin: 0 auto;
  padding: 16px 14px;
}
.we-app-blob{
  position:absolute;
  width:560px; height:560px;
  filter: blur(70px);
  opacity:.55;
  border-radius:999px;
}
.we-app-blob.b1{ top:-220px; left:-220px; background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%); }
.we-app-blob.b2{ bottom:-260px; right:-220px; background: radial-gradient(circle at 30% 30%, #22c55e, transparent 55%); }
.we-app-blob.b3{ top:25%; right:-280px; background: radial-gradient(circle at 30% 30%, #06b6d4, transparent 55%); }

.we-app-noise{
  position:absolute; inset:0;
  opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}
`;