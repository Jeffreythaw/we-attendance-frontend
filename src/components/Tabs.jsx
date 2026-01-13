import React from "react";

export function Tabs({ tab, setTab, showAdmin }) {
  const btn = (active) => ({
    flex: 1,
    padding: "10px 10px",
    borderRadius: 999,
    border: 0,
    fontWeight: 900,
    cursor: "pointer",
    background: active ? "#0f172a" : "#e2e8f0",
    color: active ? "white" : "#0f172a",
    fontSize: 13,
  });

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(15,23,42,0.10)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: 10,
          display: "flex",
          gap: 8,
        }}
      >
        <button style={btn(tab === "clock")} onClick={() => setTab("clock")}>
          Clock
        </button>
        <button
          style={btn(tab === "history")}
          onClick={() => setTab("history")}
        >
          History
        </button>

        {showAdmin ? (
          <button style={btn(tab === "admin")} onClick={() => setTab("admin")}>
            Admin
          </button>
        ) : null}

        <button
          style={btn(tab === "settings")}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>
    </div>
  );
}