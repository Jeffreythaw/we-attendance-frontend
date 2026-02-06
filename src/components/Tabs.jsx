import React from "react";
import "./Tabs.css";

export function Tabs({ tab, setTab, items }) {
  return (
    <div className="we-tabs-shell">
      <div className="we-tabs-inner">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={`we-tab-btn ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="we-tab-icon" aria-hidden="true">{it.icon}</span>
              <span className="we-tab-label">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
