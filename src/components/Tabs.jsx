import React from "react";
import "./Tabs.css";

export function Tabs({ tab, setTab, items, variant = "fixed" }) {
  return (
    <div className={`we-tabs-shell ${variant === "contained" ? "is-contained" : "is-fixed"}`}>
      <div className="we-tabs-inner">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={`we-tab-btn ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              style={it.accent ? { "--tab-accent": it.accent } : undefined}
            >
              <span className="we-tab-orb" aria-hidden="true" />
              <span className="we-tab-icon" aria-hidden="true">{it.icon}</span>
              <span className="we-tab-label">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
