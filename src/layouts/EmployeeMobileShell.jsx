import React, { useState } from "react";
import { ClockScreen } from "../screens/ClockScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import AppBackground from "./AppBackground";
import { Tabs } from "../components/Tabs";
import weWordmark from "../assets/WE_Eng.png";
import "./EmployeeMobileShell.css";
import { useTheme } from "../theme/context";

export default function EmployeeMobileShell({ user, logout }) {
  const [tab, setTab] = useState("clock");
  const { theme, toggleTheme } = useTheme();

  function onAuthError() {
    alert("Session expired. Please login again.");
    logout();
  }

  const tabs = [
    { key: "clock", label: "Clock", icon: "⏱️" },
    { key: "history", label: "History", icon: "📜" },
    { key: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="we-mobile-stage">
      <AppBackground />
      <div className="we-mobile-phone">
        <div className="we-mobile-header">
          <div className="we-mobile-brand">
            <img src={weWordmark} alt="WE Engineering" className="we-mobile-brandMark" />
            <div className="we-mobile-user">{user?.username} • {user?.role}</div>
          </div>
          <div className="we-mobile-actions">
            <button type="button" className="we-mobile-themeSwitch" onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button type="button" className="we-mobile-logout" onClick={logout}>
              🚪 Log out
            </button>
          </div>
        </div>

        <div className="we-mobile-content">
          {tab === "clock" && <ClockScreen onAuthError={onAuthError} user={user} />}
          {tab === "history" && <HistoryScreen onAuthError={onAuthError} />}
          {tab === "settings" && (
            <SettingsScreen user={user} onLogout={logout} isAdmin={false} />
          )}
        </div>

        <Tabs tab={tab} setTab={setTab} items={tabs} variant="contained" />
      </div>
    </div>
  );
}
