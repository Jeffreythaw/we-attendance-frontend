import React, { useState } from "react";
import AdminDashboard from "../screens/AdminDashboard";
import AdminEmployees from "../pages/AdminEmployees";
import AdminQuotations from "../screens/AdminQuotations";
import { SettingsScreen } from "../screens/SettingsScreen";
import ScheduleCalendarTab from "../screens/ScheduleCalendarTab";
import AppBackground from "./AppBackground";
import weWordmark from "../assets/WE_Eng.png";
import "./AdminDesktopShell.css";
import { useTheme } from "../theme/context";

export default function AdminDesktopShell({ user, logout }) {
  const [tab, setTab] = useState("dashboard");
  const { theme, toggleTheme } = useTheme();

  function onAuthError() {
    alert("Session expired. Please login again.");
    logout();
  }

  return (
    <div className="we-admin-shell">
      <AppBackground />
      <div className="we-admin-wrap">
        <div className="we-admin-top">
          <div className="we-admin-brand">
            <img src={weWordmark} alt="WE Engineering" className="we-admin-brandMark" />
            <div className="we-admin-user">{user?.username} • {user?.role}</div>
          </div>

          <div className="we-admin-tabs">
            <button type="button" className={`we-admin-tab ${tab === "dashboard" ? "is-active" : ""}`} onClick={() => setTab("dashboard")}>🧭 Dashboard</button>
            <button type="button" className={`we-admin-tab ${tab === "employees" ? "is-active" : ""}`} onClick={() => setTab("employees")}>👥 Employees</button>
            <button type="button" className={`we-admin-tab ${tab === "quotations" ? "is-active" : ""}`} onClick={() => setTab("quotations")}>🧾 Quotes</button>
            <button type="button" className={`we-admin-tab ${tab === "calendar" ? "is-active" : ""}`} onClick={() => setTab("calendar")}>📅 Calendar</button>
            <button type="button" className={`we-admin-tab ${tab === "settings" ? "is-active" : ""}`} onClick={() => setTab("settings")}>⚙️ Settings</button>
          </div>

          <div className="we-admin-actions">
            <button type="button" className="we-admin-themeSwitch" onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button type="button" className="we-admin-logout" onClick={logout}>🚪 Log out</button>
          </div>
        </div>

        <div className="we-admin-content">
          {tab === "dashboard" && <AdminDashboard onAuthError={onAuthError} />}
          {tab === "employees" && <AdminEmployees onAuthError={onAuthError} />}
          {tab === "quotations" && <AdminQuotations onAuthError={onAuthError} />}
          {tab === "calendar" && <ScheduleCalendarTab user={user} onAuthError={onAuthError} />}
          {tab === "settings" && <SettingsScreen user={user} onLogout={logout} isAdmin />}
        </div>
      </div>
    </div>
  );
}
