import React, { useState } from "react";
import { Card } from "../components/Card";
import { apiBase } from "../api/client"; // ✅ apiBase is a string

export function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", padding: "42px 14px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "#0f172a", margin: "0 auto" }} />
          <div style={{ fontSize: 24, fontWeight: 950, marginTop: 10 }}>WE Attendance</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Clock in / out</div>
        </div>

        <Card>
          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Username</div>
              <input
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid rgba(15,23,42,0.14)" }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jeffrey"
              />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>Password</div>
              <input
                style={{ width: "100%", padding: 12, borderRadius: 14, border: "1px solid rgba(15,23,42,0.14)" }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {err ? (
              <div
                style={{
                  color: "#be123c",
                  fontWeight: 800,
                  fontSize: 13,
                  background: "#ffe4e6",
                  border: "1px solid #fecdd3",
                  padding: 10,
                  borderRadius: 14,
                }}
              >
                {err}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                border: 0,
                background: "#0f172a",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {/* ✅ apiBase is a STRING, so use apiBase (no brackets) */}
            <div style={{ fontSize: 12, color: "#64748b" }}>API: {apiBase}</div>
          </form>
        </Card>
      </div>
    </div>
  );
}