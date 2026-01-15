import React from "react";

export function Tabs({ tab, setTab, items }) {
  return (
    <div style={styles.shell}>
      <div style={styles.inner}>
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              style={{
                ...styles.btn,
                ...(active ? styles.btnActive : styles.btnInactive),
              }}
              aria-current={active ? "page" : undefined}
            >
              <span style={styles.icon} aria-hidden="true">{it.icon}</span>
              <span style={styles.label}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  shell: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
    background: "rgba(15,23,42,0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderTop: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 -10px 30px rgba(0,0,0,0.35)",
    zIndex: 50,
  },
  inner: {
    maxWidth: 860,
    margin: "0 auto",
    padding: 10,
    display: "flex",
    gap: 8,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    padding: "10px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)", // ✅ always set full border
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "transform 120ms ease, filter 120ms ease, opacity 120ms ease",
    userSelect: "none",
    color: "#fff",
    background: "rgba(255,255,255,0.06)",
  },
  btnActive: {
    background: "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(236,72,153,0.9))",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  },
  btnInactive: {
    background: "rgba(255,255,255,0.06)",
  },
  icon: { fontSize: 14, lineHeight: 1 },
  label: { lineHeight: 1, whiteSpace: "nowrap" },
};