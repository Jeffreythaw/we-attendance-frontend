import React, { useMemo, useState } from "react";
import { ClockScreen } from "../screens/ClockScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import ScheduleCalendarTab from "../screens/ScheduleCalendarTab";
import AppBackground from "./AppBackground";
import { Tabs } from "../components/Tabs";
import weLogo from "../assets/welogo.png";
import "./EmployeeMobileShell.css";
import { useTheme } from "../theme/context";

function TabIcon({ type }) {
  const common = {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const paths = {
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    schedule: (
      <>
        <path d="M7 3v4M17 3v4M4 9h16" />
        <rect x="4" y="5" width="16" height="16" rx="3" />
        <path d="M8 13h3M8 17h5" />
      </>
    ),
    leave: (
      <>
        <path d="M7 4h7l4 4v12H7z" />
        <path d="M14 4v5h5M9 14h6M9 17h4" />
      </>
    ),
    history: (
      <>
        <path d="M5 5v5h5" />
        <path d="M5.5 10A7 7 0 1 0 8 5.7" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.8-4 4.5-6 8-6s6.2 2 8 6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
    moon: (
      <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3a8.5 8.5 0 1 0 11.5 11.5Z" />
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </>
    ),
  };

  return <svg {...common}>{paths[type]}</svg>;
}

export default function EmployeeMobileShell({ user, logout }) {
  const [tab, setTab] = useState("clock");
  const { theme, toggleTheme } = useTheme();

  function onAuthError() {
    alert("Session expired. Please login again.");
    logout();
  }

  const tabs = [
    { key: "clock", label: "Home", icon: <TabIcon type="clock" />, accent: "#26e0a4" },
    { key: "schedule", label: "Plan", icon: <TabIcon type="schedule" />, accent: "#f2c94c" },
    { key: "leave", label: "Leave", icon: <TabIcon type="leave" />, accent: "#ff6b8a" },
    { key: "history", label: "Logs", icon: <TabIcon type="history" />, accent: "#ff9d42" },
    { key: "settings", label: "Me", icon: <TabIcon type="settings" />, accent: "#5db9ff" },
  ];
  const roleLabel = String(user?.role || "Worker");
  const userLabel = String(user?.username || "worker");
  const avatarLabel = userLabel.slice(0, 1).toUpperCase() || "W";

  const activeTab = useMemo(() => {
    const tabContent = {
      clock: {
        title: `Welcome, ${userLabel}`,
        description: "Location ready. Mark your attendance for today.",
        highlights: [
          { label: "Present", value: "13" },
          { label: "Absent", value: "02" },
          { label: "Late in", value: "04" },
        ],
      },
      schedule: {
        title: "Attendance",
        description: "Review assigned work, location, and this month's plan.",
        highlights: [
          { label: "Month", value: "APR" },
          { label: "Shift", value: "General" },
          { label: "Status", value: "Ready" },
        ],
      },
      leave: {
        title: "Leave Details",
        description: "Submit requests and follow approval status.",
        highlights: [
          { label: "Available", value: "25" },
          { label: "Applied", value: "05" },
          { label: "Pending", value: "01" },
        ],
      },
      history: {
        title: "Reports",
        description: "Review sessions, overtime, and attendance records.",
        highlights: [
          { label: "Present", value: "13" },
          { label: "Absent", value: "02" },
          { label: "Late in", value: "04" },
        ],
      },
      settings: {
        title: "Profile",
        description: "See account details and keep your mobile settings.",
        highlights: [
          { label: "Role", value: roleLabel },
          { label: "Team", value: "WE" },
          { label: "Access", value: "Active" },
        ],
      },
    };
    return tabContent[tab] || tabContent.clock;
  }, [roleLabel, tab, userLabel]);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-SG", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date()),
    [],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  const activeAccent = tabs.find((item) => item.key === tab)?.accent || "#60a5fa";

  return (
    <div className="we-mobile-stage">
      <AppBackground />
      <div className="we-mobile-phone" style={{ "--mobile-accent": activeAccent }}>
        <div className="we-mobile-shellMain">
          <div className="we-mobile-statusbar" aria-hidden="true">
            <span className="we-mobile-statusTime">{dateLabel}</span>
            <span className="we-mobile-statusDots">
              <span />
              <span />
              <span />
            </span>
          </div>

          <div className="we-mobile-header">
            <div className="we-mobile-headerRow">
              <a
                className="we-mobile-brand"
                href="https://www.we-engineering.net/"
                target="_blank"
                rel="noreferrer"
                aria-label="Open WE Engineering website"
              >
                <div className="we-mobile-brandMarkWrap">
                  <img src={weLogo} alt="WE Logo" className="we-mobile-brandMark" />
                </div>
                <div className="we-mobile-userMeta">
                  <div className="we-mobile-kicker">WE Attendance</div>
                  <div className="we-mobile-user">{userLabel}</div>
                </div>
              </a>

              <div className="we-mobile-actions">
                <button type="button" className="we-mobile-themeSwitch" onClick={toggleTheme} aria-label="Toggle theme">
                  <TabIcon type={theme === "dark" ? "sun" : "moon"} />
                </button>
                <button type="button" className="we-mobile-logout" onClick={logout} aria-label="Log out">
                  <TabIcon type="logout" />
                </button>
                <div className="we-mobile-avatar" aria-hidden="true">
                  {avatarLabel}
                </div>
              </div>
            </div>

            <div className="we-mobile-hero">
              <div className="we-mobile-heroCopy">
                <div className="we-mobile-heroEyebrow">{greeting}</div>
                <div className="we-mobile-heroTitle">{activeTab.title}</div>
                <div className="we-mobile-heroSub">{activeTab.description}</div>
              </div>
              <div className="we-mobile-heroDate">
                <span className="we-mobile-heroDateLabel">Today</span>
                <strong>{dateLabel}</strong>
              </div>
            </div>

            <div className="we-mobile-highlightGrid">
              {activeTab.highlights.map((item) => (
                <div key={item.label} className="we-mobile-highlightCard">
                  <div className="we-mobile-highlightLabel">{item.label}</div>
                  <div className="we-mobile-highlightValue">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`we-mobile-content is-${tab}`}>
            {tab === "clock" && <ClockScreen onAuthError={onAuthError} user={user} />}
            {tab === "schedule" && <ScheduleCalendarTab user={user} onAuthError={onAuthError} />}
            {tab === "leave" && (
              <SettingsScreen
                user={user}
                initialTab="leave"
                showAccountTab={false}
                showLeaveTab
              />
            )}
            {tab === "history" && <HistoryScreen onAuthError={onAuthError} />}
            {tab === "settings" && (
              <SettingsScreen
                user={user}
                initialTab="account"
                showAccountTab
                showLeaveTab={false}
              />
            )}
          </div>
        </div>

        <Tabs tab={tab} setTab={setTab} items={tabs} variant="contained" />
      </div>
    </div>
  );
}
