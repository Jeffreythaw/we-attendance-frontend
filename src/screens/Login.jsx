import React, { useMemo, useState } from "react";
import { apiBase, setToken } from "../api/client";

// Assets
import weLogo from "../assets/WE.png";
import weWordmark from "../assets/WE_Eng.png";

export function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0 && !loading;
  }, [username, password, loading]);

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
      {/* Background with animated-style blobs */}
      <div className="we-login-bg" aria-hidden="true">
        <div className="we-login-blob we-login-blob-1" />
        <div className="we-login-blob we-login-blob-2" />
        <div className="we-login-blob we-login-blob-3" />
        <div className="we-login-noise" />
      </div>

      <div className="we-login-window">
        {/* MacOS Style Titlebar */}
        <div className="we-login-titlebar">
          <div className="we-login-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="we-login-title">WE ATTENDANCE</div>
          <div style={{ width: 50 }} />
        </div>

        {/* ✅ Full Stretch Brand Wordmark */}
        <div className="we-brandbar-full">
          <img className="we-brandWordmark" src={weWordmark} alt="WE Engineering" />
        </div>

        <div className="we-login-content">
          <div className="we-login-header-vertical">
            {/* ✅ Centered, Large Hero Logo */}
            <div className="we-logo-hero">
              <div className="we-logo-glow" />
              <img src={weLogo} alt="WE Logo" className="we-logo-img-large" />
            </div>

            <div className="we-text-center">
              <div className="we-login-kicker">Secure Access Portal</div>
              <h1 className="we-login-h1">Welcome Back</h1>
              <p className="we-login-sub">Manage your clock-in/out seamlessly.</p>
            </div>
          </div>

          <form onSubmit={submit} className="we-login-form">
            <div className="we-field">
              <label className="we-login-label">Username</label>
              <div className="we-input">
                <span className="we-icon">👤</span>
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
              <div className="we-input">
                <span className="we-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="we-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="we-login-row">
              <label className="we-check">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>Show Password</span>
              </label>
              <button 
                type="button" 
                className="we-link"
                onClick={() => alert("Please contact your administrator for a password reset.")}
              >
                Forgot?
              </button>
            </div>

            {err && <div className="we-error">{err}</div>}

            <button type="submit" className="we-btn" disabled={!canSubmit}>
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

          <div className="we-footer">
            <span className="we-pill">V2.4</span>
            <span className="we-api">{apiBase() || "Cloud Production"}</span>
          </div>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
:root { 
  --primary: #6366f1; 
  --accent: #ec4899; 
  --glass: rgba(15, 20, 35, 0.7);
  --border: rgba(255, 255, 255, 0.12);
}

.we-login-root {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: #050810; font-family: -apple-system, system-ui, sans-serif;
  color: #fff; position: relative; overflow: hidden;
}

/* Glass Background */
.we-login-bg { position: absolute; inset: 0; z-index: 0; }
.we-login-blob { position: absolute; width: 600px; height: 600px; filter: blur(80px); opacity: 0.45; border-radius: 50%; }
.we-login-blob-1 { top: -200px; left: -150px; background: radial-gradient(circle, #4f46e5 0%, transparent 70%); }
.we-login-blob-2 { bottom: -200px; right: -150px; background: radial-gradient(circle, #10b981 0%, transparent 70%); }
.we-login-blob-3 { top: 20%; right: -200px; background: radial-gradient(circle, #7c3aed 0%, transparent 70%); }

.we-login-noise { 
  position: absolute; inset: 0; opacity: 0.04; 
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.we-login-window {
  z-index: 10; width: 100%; max-width: 420px;
  background: var(--glass);
  backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);
  border: 1px solid var(--border);
  border-radius: 32px; box-shadow: 0 40px 120px rgba(0,0,0,0.7);
  overflow: hidden;
}

/* Titlebar */
.we-login-titlebar {
  padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;
  background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--border);
}
.we-login-dots { display: flex; gap: 6px; }
.dot { width: 11px; height: 11px; border-radius: 50%; }
.dot-red { background: #ff5f57; } .dot-yellow { background: #febc2e; } .dot-green { background: #28c840; }
.we-login-title { font-size: 10px; font-weight: 800; opacity: 0.4; letter-spacing: 2px; }

/* ✅ Full-Width Wordmark Styling */
.we-brandWordmark {
  width: 100%;             /* This forces it to span the full container width */
  height: auto;            /* Maintains the correct aspect ratio */
  object-fit: contain;     /* Ensures it doesn't get distorted */
  display: block;          /* Removes any bottom whitespace */
  filter: drop-shadow(0 0 12px rgba(255,255,255,0.1));
}

/* Also, ensure the wrapper allows it to go edge-to-edge */
.we-brandbar-full {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid var(--border);
  padding: 0;              /* Remove padding so the image touches the edges */
  display: flex;
  justify-content: center;
  overflow: hidden;        /* Keeps the image within the rounded corners */
}

.we-login-content { padding: 32px 36px; }

/* ✅ Large Centered Logo Styling */
.we-login-header-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px; /* Increased from 32px to handle the bigger logo */
  text-align: center;
}
.we-logo-hero { position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.we-logo-glow {
  position: absolute; width: 130px; height: 130px; 
  background: radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%);
  filter: blur(20px); z-index: 0;
}
.we-logo-img-large {
  width: 230px; /* Large center logo */
  height: auto;
  position: relative; z-index: 1;
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.4));
}

.we-login-h1 { font-size: 26px; font-weight: 900; margin: 0; color: #fff; letter-spacing: -0.5px; }
.we-login-kicker { font-size: 11px; font-weight: 800; color: #818cf8; text-transform: uppercase; margin-bottom: 6px; }
.we-login-sub { font-size: 14px; opacity: 0.5; margin-top: 6px; }

/* Inputs & Form */
.we-login-form { display: flex; flex-direction: column; gap: 20px; }
.we-login-label { font-size: 12px; font-weight: 700; margin-bottom: 8px; display: block; opacity: 0.8; letter-spacing: 0.5px; }
.we-input {
  background: rgba(0,0,0,0.35); border: 1px solid var(--border);
  border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.we-input:focus-within { border-color: var(--primary); background: rgba(0,0,0,0.5); box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15); }
.we-input input { background: transparent; border: none; color: #fff; outline: none; flex: 1; font-size: 15px; }
.we-icon { font-size: 16px; opacity: 0.6; }
.we-eye { background: none; border: none; color: #fff; opacity: 0.5; cursor: pointer; padding: 4px; font-size: 16px; }

.we-login-row { display: flex; justify-content: space-between; align-items: center; }
.we-check { display: flex; align-items: center; gap: 10px; font-size: 13px; opacity: 0.7; cursor: pointer; }
.we-link { background: none; border: none; color: #818cf8; font-size: 13px; cursor: pointer; font-weight: 600; }

.we-btn {
  width: 100%; padding: 16px; border-radius: 14px; border: none;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff; font-weight: 800; font-size: 16px; cursor: pointer;
  transition: all 0.3s; box-shadow: 0 12px 24px rgba(0,0,0,0.4);
  display: flex; justify-content: center; align-items: center;
}
.we-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 15px 30px rgba(99, 102, 241, 0.3); }
.we-btn:active:not(:disabled) { transform: translateY(0); }
.we-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.we-btn-content { display: flex; align-items: center; gap: 12px; }

.we-error {
  background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3);
  color: #fda4af; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 600; text-align: center;
}

.we-footer { margin-top: 28px; display: flex; align-items: center; justify-content: center; gap: 10px; opacity: 0.35; font-size: 11px; }
.we-pill { border: 1px solid #fff; padding: 2px 8px; border-radius: 8px; font-weight: 800; letter-spacing: 0.5px; }
.we-api { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 480px) {
  .we-login-window { border-radius: 0; min-height: 100vh; max-width: 100%; }
  .we-login-root { padding: 0; }
}
`;