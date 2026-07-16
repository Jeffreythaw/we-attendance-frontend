import React, { useMemo, useState } from "react";
import { setToken } from "../api/client";
import weLogo from "../assets/welogo.png";

export function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.length > 0 && !loading,
    [username, password, loading],
  );

  function pickToken(result) {
    if (!result) return null;
    return result.token || result.Token || result.accessToken || result.access_token || null;
  }

  function pickUser(result) {
    if (!result) return null;
    return result.user || result.User || null;
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const result = await onLogin?.(username.trim(), password);

      if (typeof result === "string" && result.trim()) {
        setToken(result.trim());
      }

      if (result && typeof result === "object") {
        const token = pickToken(result);
        if (token) setToken(token);

        const user = pickUser(result);
        if (user) {
          try {
            localStorage.setItem("we_user", JSON.stringify(user));
          } catch {
            // ignore
          }
        }
      }
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="we-login-root">
      <div className="we-login-bg" aria-hidden="true">
        <div className="we-login-grid" />
        <div className="we-login-glow we-login-glow-a" />
        <div className="we-login-glow we-login-glow-b" />
      </div>

      <div className="we-login-window">
        <a
          className="we-login-brandStrip"
          href="https://www.we-engineering.net/"
          target="_blank"
          rel="noreferrer"
          aria-label="Open WE Engineering website"
        >
          <img className="we-brandWordmark" src={weLogo} alt="WE Logo" />
          <span>
            <strong>WE Attendance</strong>
            <small>www.we-engineering.net</small>
          </span>
        </a>

        <div className="we-login-content">
          <div className="we-login-header">
            <div className="we-logo-hero">
              <img src={weLogo} alt="WE Logo" className="we-logo-img" />
            </div>

            <div className="we-login-copy">
              <div className="we-login-kicker">Attendance workspace</div>
              <h1 className="we-login-h1">Sign in to your shift</h1>
              <p className="we-login-sub">
                Check in, review schedules, and manage leave from your phone.
              </p>
            </div>
          </div>

          <div className="we-login-tags" aria-hidden="true">
            <span>Live attendance</span>
            <span>Leave tracking</span>
            <span>Mobile ready</span>
          </div>

          <form onSubmit={submit} className="we-login-form">
            <div className="we-field">
              <label className="we-login-label">Username</label>
              <div className="we-input we-login-input">
                <span className="we-icon we-login-icon">ID</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="we-field">
              <label className="we-login-label">Password</label>
              <div className="we-input we-login-input">
                <span className="we-icon we-login-icon">PW</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="we-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="we-login-row">
              <button
                type="button"
                className="we-link"
                onClick={() => alert("Please contact your administrator for a password reset.")}
              >
                Forgot?
              </button>
            </div>

            {err && <div className="we-error">{err}</div>}

            <button type="submit" className="we-btn we-login-btn" disabled={!canSubmit}>
              {loading ? (
                <div className="we-btn-content">
                  <div className="spinner" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="we-login-foot">
            <span>WE Engineering attendance portal</span>
            <a href="https://www.we-engineering.net/" target="_blank" rel="noreferrer">
              Company site
            </a>
          </div>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:wght@700;900&display=swap');

:root {
  --primary: #2449da;
  --accent: #00a7a0;
  --surface: rgba(255, 255, 255, 0.9);
  --border: rgba(27, 52, 93, 0.12);
  --ink: #183153;
  --muted: #607693;
}

.we-login-root {
  min-height: 100vh;
  padding: 24px 18px calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  background: linear-gradient(180deg, #eef4fb 0%, #f8fbff 48%, #eef3f7 100%);
  color: var(--ink);
}

.we-login-bg {
  position: absolute;
  inset: 0;
}

.we-login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(61, 94, 137, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(61, 94, 137, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
}

.we-login-glow {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
}

.we-login-glow-a {
  top: -120px;
  right: -100px;
  background: rgba(40, 73, 216, 0.28);
}

.we-login-glow-b {
  bottom: -150px;
  left: -80px;
  background: rgba(0, 167, 160, 0.2);
}

.we-login-window {
  position: relative;
  z-index: 1;
  width: min(100%, 460px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 30px;
  overflow: hidden;
  box-shadow: 0 30px 90px rgba(74, 97, 128, 0.2);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.we-login-brandStrip {
  padding: 18px 22px 14px;
  background: linear-gradient(180deg, rgba(225, 236, 248, 0.95), rgba(240, 246, 252, 0.7));
  border-bottom: 1px solid rgba(27, 52, 93, 0.08);
}

.we-brandWordmark {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.we-login-content {
  display: grid;
  gap: 20px;
  padding: 28px 22px 24px;
}

.we-login-header {
  display: grid;
  gap: 14px;
  justify-items: center;
  text-align: center;
}

.we-logo-hero {
  width: 88px;
  height: 88px;
  padding: 10px;
  border-radius: 24px;
  background: linear-gradient(180deg, #0f1728, #1e2e4c);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
}

.we-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.we-login-copy {
  display: grid;
  gap: 6px;
}

.we-login-kicker {
  color: #6b87b2;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.we-login-h1 {
  margin: 0;
  font-family: "Fraunces", Georgia, serif;
  font-size: 36px;
  line-height: 0.95;
  color: #1b3358;
}

.we-login-sub {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.we-login-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.we-login-tags span {
  padding: 8px 12px;
  border-radius: 999px;
  background: #edf3fb;
  border: 1px solid rgba(40, 73, 216, 0.08);
  color: #4e688d;
  font-size: 12px;
  font-weight: 700;
}

.we-login-form {
  display: grid;
  gap: 16px;
}

.we-field {
  display: grid;
  gap: 7px;
}

.we-login-label {
  font-size: 12px;
  font-weight: 700;
  color: #5a7396;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.we-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 0 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(24, 49, 83, 0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
}

.we-input input {
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.we-input input::placeholder {
  color: #8aa0bd;
}

.we-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #edf3fb;
  color: #4f6991;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.we-eye {
  border: 0;
  background: transparent;
  color: #7b90ad;
  font-size: 16px;
}

.we-login-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.we-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}

.we-link {
  border: 0;
  background: transparent;
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
}

.we-error {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.12);
  color: #b42318;
  font-size: 13px;
  font-weight: 600;
}

.we-btn {
  min-height: 58px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(135deg, #2449da, #3577f6);
  color: white;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 18px 30px rgba(36, 73, 218, 0.22);
}

.we-btn:disabled {
  opacity: 0.55;
  box-shadow: none;
}

.we-btn-content {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.38);
  border-top-color: white;
  animation: we-spin 0.8s linear infinite;
}

@keyframes we-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .we-login-root {
    padding: 0;
    align-items: stretch;
  }

  .we-login-window {
    width: 100%;
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }

  .we-login-content {
    padding: 28px 18px 22px;
  }

  .we-login-h1 {
    font-size: 31px;
  }
}

/* WE mobile redesign */
html,
body {
  background: #070b10 !important;
}

.we-login-root {
  font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  min-height: 100vh;
  min-height: 100dvh;
  height: 100vh;
  height: 100dvh;
  background:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(180deg, #070b10 0%, #121a22 52%, #080c11 100%);
  background-size: 28px 28px, 28px 28px, auto;
  color: #f7fafc;
}

.we-login-grid,
.we-login-glow {
  display: none;
}

.we-login-window {
  min-height: 100%;
  background: linear-gradient(180deg, rgba(18, 25, 33, 0.98), rgba(10, 15, 21, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.42);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.we-login-brandStrip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #f7fafc;
  font-size: 14px;
  font-weight: 850;
  letter-spacing: 0.02em;
  text-decoration: none;
}

.we-brandWordmark {
  width: 42px;
  height: 42px;
  padding: 5px;
  border-radius: 10px;
  background: #f8fbff;
  object-fit: contain;
}

.we-login-content {
  gap: 18px;
}

.we-login-header {
  justify-items: start;
  text-align: left;
}

.we-logo-hero {
  width: 74px;
  height: 74px;
  padding: 8px;
  border-radius: 14px;
  background: #f8fbff;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
}

.we-login-kicker {
  color: rgba(38, 224, 164, 0.86);
  font-size: 10px;
  letter-spacing: 0.14em;
}

.we-login-root .we-login-h1 {
  font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  color: #f7fafc;
  font-size: 32px;
  line-height: 1.04;
  letter-spacing: 0;
  max-width: 10ch;
  overflow-wrap: anywhere;
}

.we-login-sub {
  color: rgba(225, 235, 242, 0.68);
}

.we-login-tags span {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(225, 235, 242, 0.72);
}

.we-login-label {
  color: rgba(38, 224, 164, 0.78);
}

.we-login-root .we-input {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.065) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: none !important;
}

.we-login-root .we-input input {
  color: #f7fafc !important;
}

.we-login-root .we-input input::placeholder {
  color: rgba(225, 235, 242, 0.38) !important;
}

.we-login-root .we-icon {
  border-radius: 8px;
  background: rgba(38, 224, 164, 0.12);
  color: #26e0a4;
}

.we-eye,
.we-link {
  color: #26e0a4;
  font-size: 12px;
  font-weight: 850;
}

.we-check {
  color: rgba(225, 235, 242, 0.68);
}

.we-error {
  background: rgba(255, 95, 126, 0.12);
  border-color: rgba(255, 95, 126, 0.28);
  color: #ffb7c5;
}

.we-login-root .we-btn {
  border-radius: 12px;
  background: linear-gradient(135deg, #26e0a4, #a6f76a) !important;
  color: #061015 !important;
  box-shadow: 0 18px 30px rgba(38, 224, 164, 0.18) !important;
}

.we-login-root .we-btn:disabled {
  background: rgba(255, 255, 255, 0.09) !important;
  color: rgba(225, 235, 242, 0.42) !important;
}

.we-login-root .we-login-input,
html.theme-light .we-login-root .we-login-input {
  background: rgba(255, 255, 255, 0.065) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #f7fafc !important;
}

.we-login-root .we-login-input input,
html.theme-light .we-login-root .we-login-input input {
  background: transparent !important;
  color: #f7fafc !important;
  -webkit-text-fill-color: #f7fafc;
}

.we-login-root .we-login-icon {
  background: rgba(38, 224, 164, 0.12) !important;
  color: #26e0a4 !important;
}

.we-login-root .we-login-btn,
html.theme-light .we-login-root .we-login-btn {
  background: linear-gradient(135deg, #26e0a4, #a6f76a) !important;
  color: #061015 !important;
}

.we-login-root .we-login-btn:disabled,
html.theme-light .we-login-root .we-login-btn:disabled {
  background: rgba(255, 255, 255, 0.09) !important;
  color: rgba(225, 235, 242, 0.42) !important;
}

@media (max-width: 640px) {
  .we-login-window {
    min-height: 100vh;
    min-height: 100dvh;
    height: 100vh;
    height: 100dvh;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }

  .we-login-content {
    padding: 26px 18px 22px;
  }
}

/* SiAP-inspired blue Material login skin */
.we-login-root {
  align-items: stretch;
  justify-content: stretch;
  background: #eeeeee !important;
  color: #26364d;
  overflow-x: hidden;
  overflow-y: auto;
}

html,
body {
  background: #eeeeee !important;
}

.we-login-bg {
  display: block;
}

.we-login-bg::before,
.we-login-bg::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  background: linear-gradient(180deg, #1e88e5, #2962ff);
  box-shadow: 0 12px 32px rgba(41, 98, 255, 0.22);
}

.we-login-bg::before {
  width: 330px;
  height: 330px;
  left: -92px;
  top: -82px;
}

.we-login-bg::after {
  width: 230px;
  height: 230px;
  right: -80px;
  top: -70px;
  opacity: 0.82;
}

.we-login-window {
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr;
  background: transparent;
  border: 0;
  box-shadow: none;
  overflow: visible;
}

.we-login-brandStrip {
  position: relative;
  z-index: 2;
  min-height: 96px;
  padding: 22px 20px;
  background: transparent;
  border: 0;
  color: #ffffff;
}

.we-brandWordmark {
  width: 58px;
  height: 58px;
  padding: 7px;
  border-radius: 8px;
  background: #ffffff;
}

.we-login-content {
  position: relative;
  z-index: 2;
  align-content: start;
  gap: 16px;
  padding: 22px 18px 26px;
  overflow-x: hidden;
}

.we-login-header {
  justify-items: center;
  text-align: center;
  margin-bottom: 10px;
}

.we-logo-hero {
  width: 92px;
  height: 92px;
  padding: 10px;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(31, 45, 61, 0.18);
}

.we-login-kicker {
  color: #2962ff;
}

.we-login-root .we-login-h1 {
  max-width: 13ch;
  color: #26364d;
  font-size: 28px;
  text-align: center;
}

.we-login-sub {
  color: #687789;
  text-align: center;
  max-width: 30ch;
  margin-left: auto;
  margin-right: auto;
}

.we-login-tags {
  display: none;
}

.we-login-tags span {
  flex: 1 1 104px;
  min-width: 0;
  text-align: center;
  white-space: nowrap;
  background: #ffffff;
  border: 0;
  color: #60758f;
  box-shadow: 0 4px 12px rgba(31, 45, 61, 0.08);
}

.we-login-form {
  padding: 12px 12px 16px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(31, 45, 61, 0.16);
}

.we-login-label {
  color: #2962ff;
}

.we-login-root .we-login-input,
html.theme-light .we-login-root .we-login-input {
  min-height: 54px;
  padding: 0 10px;
  border-radius: 0 !important;
  background: #ffffff !important;
  border: 0 !important;
  border-bottom: 1px solid rgba(41, 98, 255, 0.22) !important;
  color: #26364d !important;
}

.we-login-root .we-login-input input,
html.theme-light .we-login-root .we-login-input input {
  color: #26364d !important;
  -webkit-text-fill-color: #26364d;
}

.we-login-root .we-login-input input::placeholder {
  color: #8b97a8 !important;
}

.we-login-root .we-login-icon {
  background: transparent !important;
  color: #2962ff !important;
}

.we-check {
  color: #687789;
}

.we-eye,
.we-link {
  color: #0d47a1;
}

.we-login-root .we-login-btn,
html.theme-light .we-login-root .we-login-btn {
  min-height: 48px;
  width: min(58%, 230px);
  border-radius: 10px;
  background: linear-gradient(135deg, #1e88e5, #0d47a1) !important;
  color: #ffffff !important;
  box-shadow: 0 8px 18px rgba(30, 136, 229, 0.28) !important;
}

.we-login-root .we-login-btn:disabled,
html.theme-light .we-login-root .we-login-btn:disabled {
  background: linear-gradient(135deg, #90caf9, #5e97f6) !important;
  color: rgba(255, 255, 255, 0.76) !important;
}

/* Final login pass to match the requested polished attendance mockups */
.we-login-root {
  --login-blue: #2465e8;
  --login-blue-2: #1455d9;
  --login-bg: #f4f7fb;
  --login-surface: #ffffff;
  --login-text: #101828;
  --login-muted: #667085;
  --login-line: #e7ecf3;
  font-family: Inter, "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--login-bg) !important;
}

html.theme-dark .we-login-root {
  --login-blue: #2f72ff;
  --login-blue-2: #1f57d6;
  --login-bg: #0d1117;
  --login-surface: #171d26;
  --login-text: #f8fafc;
  --login-muted: #9aa7b8;
  --login-line: #273242;
}

.we-login-bg::before {
  width: 360px;
  height: 360px;
  left: -110px;
  top: -115px;
  background: linear-gradient(180deg, var(--login-blue), var(--login-blue-2));
}

.we-login-bg::after {
  width: 230px;
  height: 230px;
  right: -110px;
  top: -82px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--login-blue) 72%, white), var(--login-blue));
}

.we-login-brandStrip {
  min-height: 84px;
  padding: 22px 40px;
  color: #fff;
}

.we-brandWordmark {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  box-shadow: 0 10px 22px rgba(31, 46, 78, 0.12);
}

.we-login-content {
  padding: 48px 18px 24px;
}

.we-logo-hero {
  width: 112px;
  height: 112px;
  border-radius: 18px;
  background: var(--login-surface);
  box-shadow: 0 14px 28px rgba(31, 46, 78, 0.16);
}

.we-login-kicker {
  color: var(--login-blue);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.we-login-root .we-login-h1 {
  color: var(--login-text);
  font-size: 30px;
  line-height: 1.03;
  font-weight: 850;
}

.we-login-sub {
  color: var(--login-muted);
  font-size: 14px;
}

.we-login-form {
  margin-top: 2px;
  padding: 16px 12px 18px;
  border-radius: 18px;
  background: var(--login-surface);
  box-shadow: 0 16px 34px rgba(31, 46, 78, 0.14);
}

.we-login-label {
  color: var(--login-blue);
  font-size: 11px;
  font-weight: 900;
}

.we-login-root .we-login-input,
html.theme-light .we-login-root .we-login-input {
  background: var(--login-surface) !important;
  border-bottom-color: color-mix(in srgb, var(--login-blue) 22%, var(--login-line)) !important;
}

.we-login-root .we-login-input input,
html.theme-light .we-login-root .we-login-input input,
html.theme-dark .we-login-root .we-login-input input {
  color: var(--login-text) !important;
  -webkit-text-fill-color: var(--login-text);
}

.we-check {
  color: var(--login-muted);
}

.we-login-root .we-login-btn,
html.theme-light .we-login-root .we-login-btn,
html.theme-dark .we-login-root .we-login-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 14px;
  background: var(--login-blue) !important;
  color: #fff !important;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--login-blue) 28%, transparent) !important;
}

/* Final production login polish */
.we-login-root {
  --login-bg: #f4f7fb;
  --login-surface: #ffffff;
  --login-panel: #eef4ff;
  --login-text: #111827;
  --login-muted: #5f6f86;
  --login-line: #dde6f2;
  --login-blue: #2466e8;
  --login-blue-2: #1554d6;
  min-height: 100dvh;
  height: 100dvh;
  padding: 0 !important;
  align-items: stretch !important;
  justify-content: center !important;
  background:
    radial-gradient(circle at 12% 4%, rgba(36, 102, 232, .22), transparent 30%),
    radial-gradient(circle at 92% 12%, rgba(21, 84, 214, .16), transparent 24%),
    linear-gradient(180deg, #f7faff 0%, var(--login-bg) 62%, #eef3f9 100%) !important;
  color: var(--login-text) !important;
  overflow: hidden auto;
  color-scheme: light;
}

html.theme-dark .we-login-root {
  --login-bg: #0d1118;
  --login-surface: #171e29;
  --login-panel: #101722;
  --login-text: #f8fafc;
  --login-muted: #a6b0c0;
  --login-line: #283344;
  --login-blue: #3b7bff;
  --login-blue-2: #2466e8;
  background:
    radial-gradient(circle at 12% 4%, rgba(59, 123, 255, .26), transparent 30%),
    radial-gradient(circle at 92% 12%, rgba(36, 102, 232, .18), transparent 24%),
    linear-gradient(180deg, #0d1118 0%, #111827 60%, #0b1017 100%) !important;
  color-scheme: dark;
}

.we-login-bg,
.we-login-bg::before,
.we-login-bg::after {
  display: none !important;
}

.we-login-window {
  width: min(100%, 460px) !important;
  min-height: 100dvh !important;
  margin: 0 auto !important;
  display: grid !important;
  grid-template-rows: auto minmax(0, 1fr) !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.we-login-brandStrip {
  min-height: auto !important;
  padding: calc(14px + env(safe-area-inset-top, 0px)) 18px 12px !important;
  display: flex !important;
  align-items: center !important;
  gap: 11px !important;
  color: var(--login-text) !important;
  text-decoration: none !important;
  background: transparent !important;
}

.we-login-brandStrip span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.we-login-brandStrip strong {
  font-size: 15px;
  line-height: 1.1;
  font-weight: 900;
}

.we-login-brandStrip small {
  color: var(--login-muted);
  font-size: 11px;
  line-height: 1.1;
  font-weight: 750;
}

.we-brandWordmark {
  width: 44px !important;
  height: 44px !important;
  padding: 6px !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  border: 1px solid var(--login-line);
  box-shadow: 0 8px 18px rgba(31, 45, 61, .1) !important;
}

.we-login-content {
  min-height: 0;
  padding: 18px 18px calc(18px + env(safe-area-inset-bottom, 0px)) !important;
  display: grid !important;
  align-content: start !important;
  gap: 16px !important;
}

.we-login-header {
  margin: 0 !important;
  display: grid !important;
  justify-items: start !important;
  text-align: left !important;
  gap: 14px !important;
  padding: 18px !important;
  border-radius: 24px !important;
  background:
    radial-gradient(circle at 84% 10%, rgba(255,255,255,.16), transparent 28%),
    linear-gradient(180deg, var(--login-blue), var(--login-blue-2)) !important;
  color: #ffffff !important;
  box-shadow: 0 16px 34px color-mix(in srgb, var(--login-blue) 24%, transparent);
}

.we-logo-hero {
  width: 74px !important;
  height: 74px !important;
  padding: 9px !important;
  border-radius: 17px !important;
  background: #ffffff !important;
  box-shadow: 0 12px 26px rgba(0,0,0,.16) !important;
}

.we-login-kicker {
  color: rgba(255,255,255,.72) !important;
  font-size: 11px !important;
  letter-spacing: .08em !important;
  font-weight: 850 !important;
}

.we-login-root .we-login-h1 {
  max-width: 13ch !important;
  color: #ffffff !important;
  font-size: 30px !important;
  line-height: 1.04 !important;
  font-weight: 900 !important;
  text-align: left !important;
}

.we-login-sub {
  max-width: 31ch !important;
  margin: 0 !important;
  color: rgba(255,255,255,.78) !important;
  text-align: left !important;
  line-height: 1.42 !important;
}

.we-login-form {
  margin: 0 !important;
  padding: 16px !important;
  display: grid !important;
  gap: 14px !important;
  border-radius: 22px !important;
  background: var(--login-surface) !important;
  border: 1px solid var(--login-line) !important;
  box-shadow: 0 12px 28px rgba(31, 45, 61, .12) !important;
}

html.theme-dark .we-login-form {
  box-shadow: 0 18px 36px rgba(0,0,0,.28) !important;
}

.we-login-label {
  color: var(--login-blue) !important;
  font-size: 11px !important;
  letter-spacing: .045em !important;
  font-weight: 900 !important;
}

.we-login-root .we-login-input,
html.theme-light .we-login-root .we-login-input,
html.theme-dark .we-login-root .we-login-input {
  min-height: 52px !important;
  padding: 0 12px !important;
  border-radius: 16px !important;
  background: var(--login-panel) !important;
  border: 1px solid var(--login-line) !important;
  border-bottom: 1px solid var(--login-line) !important;
  box-shadow: none !important;
}

.we-login-root .we-login-input input,
html.theme-light .we-login-root .we-login-input input,
html.theme-dark .we-login-root .we-login-input input {
  color: var(--login-text) !important;
  -webkit-text-fill-color: var(--login-text) !important;
  font-size: 15px !important;
  font-weight: 750 !important;
}

.we-login-root .we-login-input input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--login-panel) inset !important;
  -webkit-text-fill-color: var(--login-text) !important;
  caret-color: var(--login-text);
}

.we-login-root .we-login-input input::placeholder {
  color: color-mix(in srgb, var(--login-muted) 72%, transparent) !important;
  -webkit-text-fill-color: color-mix(in srgb, var(--login-muted) 72%, transparent) !important;
}

.we-login-root .we-login-icon {
  width: 30px !important;
  height: 30px !important;
  border-radius: 10px !important;
  background: color-mix(in srgb, var(--login-blue) 12%, var(--login-surface)) !important;
  color: var(--login-blue) !important;
}

.we-login-row {
  align-items: center;
  justify-content: flex-end;
}

.we-check {
  color: var(--login-muted) !important;
  font-size: 13px !important;
}

.we-check input {
  accent-color: var(--login-blue);
}

.we-eye,
.we-link {
  color: var(--login-blue) !important;
  font-weight: 900 !important;
}

.we-error {
  border-radius: 16px !important;
}

.we-login-root .we-login-btn,
html.theme-light .we-login-root .we-login-btn,
html.theme-dark .we-login-root .we-login-btn {
  width: 100% !important;
  min-height: 52px !important;
  border-radius: 16px !important;
  background: linear-gradient(135deg, var(--login-blue), var(--login-blue-2)) !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  box-shadow: 0 12px 24px color-mix(in srgb, var(--login-blue) 24%, transparent) !important;
}

.we-login-root .we-login-btn:disabled,
html.theme-light .we-login-root .we-login-btn:disabled,
html.theme-dark .we-login-root .we-login-btn:disabled {
  opacity: .58 !important;
  background: color-mix(in srgb, var(--login-blue) 42%, var(--login-muted)) !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

.we-login-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: var(--login-muted);
  font-size: 11px;
  font-weight: 750;
  padding: 0 2px;
}

.we-login-foot a {
  color: var(--login-blue);
  text-decoration: none;
  font-weight: 900;
}

@media (max-width: 360px) {
  .we-login-root .we-login-h1 {
    font-size: 27px !important;
  }

  .we-login-content {
    padding-left: 14px !important;
    padding-right: 14px !important;
  }
}
`;
