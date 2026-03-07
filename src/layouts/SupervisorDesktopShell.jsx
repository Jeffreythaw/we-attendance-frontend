import React, { useState } from "react";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ClockScreen } from "../screens/ClockScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import AppBackground from "./AppBackground";
import weWordmark from "../assets/WE_Eng.png";
import "./AdminDesktopShell.css";

export default function SupervisorDesktopShell({ user, logout }) {
  const [tab, setTab] = useState("clock");

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
            <button
              type="button"
              className={`we-admin-tab ${tab === "clock" ? "is-active" : ""}`}
              onClick={() => setTab("clock")}
            >
              Clock
            </button>
            <button
              type="button"
              className={`we-admin-tab ${tab === "history" ? "is-active" : ""}`}
              onClick={() => setTab("history")}
            >
              History
            </button>
            <button
              type="button"
              className={`we-admin-tab ${tab === "settings" ? "is-active" : ""}`}
              onClick={() => setTab("settings")}
            >
              Settings
            </button>
          </div>

          <button type="button" className="we-admin-logout" onClick={logout}>Log out</button>
        </div>

        <div className="we-admin-content">
          {tab === "clock" && <ClockScreen onAuthError={onAuthError} user={user} />}
          {tab === "history" && <HistoryScreen onAuthError={onAuthError} />}
          {tab === "settings" && <SettingsScreen user={user} onLogout={logout} isAdmin={false} />}
        </div>
      </div>
    </div>
  );
}
