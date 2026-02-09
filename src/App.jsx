// src/App.jsx
import React, { useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./screens/Login";

import { ClockScreen } from "./screens/ClockScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

import AdminDashboard from "./screens/AdminDashboard";
import AdminEmployees from "./pages/AdminEmployees";
import AdminQuotations from "./screens/AdminQuotations";
import weWordmark from "./assets/WE_Eng.png";

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
          { key: "quotations", label: "Quotes", icon: "🧾" },
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
          className={`we-app-header ${isAdmin ? "is-admin" : "is-employee"}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div className="we-app-brand" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <img
              src={weWordmark}
              alt="WE Engineering"
              className="we-app-brandMark"
            />
            <div style={{ minWidth: 0 }}>
              <div
                className="we-app-brandTextSub we-muted"
                style={{ fontSize: 12 }}
              >
                {user?.username} • {user?.role}
              </div>
            </div>
          </div>

          <button type="button" className="we-app-logout" onClick={logout}>
            Log out
          </button>
        </div>

        {/* Screens */}
        {!isAdmin && tab === "clock" && <ClockScreen onAuthError={onAuthError} />}
        {!isAdmin && tab === "history" && <HistoryScreen onAuthError={onAuthError} />}

        {isAdmin && tab === "dashboard" && <AdminDashboard onAuthError={onAuthError} />}
        {isAdmin && tab === "employees" && <AdminEmployees onAuthError={onAuthError} />}
        {isAdmin && tab === "quotations" && <AdminQuotations onAuthError={onAuthError} />}

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


.we-app-header{ position:relative; z-index:2; }
.we-app-brandMark{
  width: 140px;
  height: 44px;
  object-fit: contain;
  object-position: left center;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(15,23,42,.4);
  box-shadow: 0 12px 24px rgba(0,0,0,0.25);
  padding: 4px 6px;
  flex: 0 0 auto;
}
.we-app-logout{
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(15,23,42,.55);
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 900;
  border-radius: 12px;
  padding: 8px 12px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
}
.we-app-logout:hover{
  background: rgba(30,41,59,.72);
  border-color: rgba(255,255,255,.3);
}
.we-app-logout:active{
  transform: translateY(1px);
}
@media (max-width: 520px){
  .we-app-header.is-employee{
    margin-bottom: 6px !important;
    padding: 8px 10px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.35);
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 10px 24px rgba(0,0,0,0.25);
  }
  .we-app-header.is-employee .we-app-brand{
    gap: 8px;
  }
  .we-app-header.is-employee .we-app-brandMark{
    width: 112px !important;
    height: 34px !important;
    border-radius: 10px !important;
    padding: 3px 5px !important;
  }
  .we-app-header.is-employee .we-app-brandTextSub{
    font-size: 10px !important;
    opacity: 0.7;
  }
  .we-app-header.is-employee .we-app-logout{
    padding: 6px 10px !important;
    font-size: 12px !important;
  }
  .we-container{ padding-top: 8px; }
}

.we-app-noise{
  position:absolute; inset:0;
  opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}
`;
