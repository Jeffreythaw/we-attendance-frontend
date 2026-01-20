import React, { useMemo, useState } from "react";
import { apiBase, setToken } from "../api/client";

// ✅ Option A (src/assets)
import weLogo from "../assets/welogo.png";
import weWordmark from "../assets/WE_Eng.png";

// ✅ Option B (public) instead of imports:
// const weLogo = "/welogo.png";
// const weWordmark = "/WE_Eng.png";

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
    return (
      result.token ||
      result.Token ||
      result.accessToken ||
      result.access_token ||
      null
    );
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
      // onLogin might:
      // 1) return { token, user }
      // 2) return just token string
      // 3) return nothing but already stores token internally
      const result = await onLogin?.(username.trim(), password);

      // If onLogin returns a string token
      if (typeof result === "string" && result.trim()) {
        setToken(result.trim());
      }

      // If onLogin returns an object with token/user
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

      // If onLogin returns nothing, we assume it already handled token storage.
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="we-login-root">
      {/* background */}
      <div className="we-login-bg" aria-hidden="true">
        <div className="we-login-blob we-login-blob-1" />
        <div className="we-login-blob we-login-blob-2" />
        <div className="we-login-blob we-login-blob-3" />
        <div className="we-login-noise" />
      </div>

      {/* window */}
      <div className="we-login-window">
        {/* mac titlebar */}
        <div className="we-login-titlebar">
          <div className="we-login-dots" aria-hidden="true">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>

          <div className="we-login-title">WE Attendance</div>
          <div style={{ width: 66 }} />
        </div>

        <div className="we-login-content">
          {/* ✅ Brand banner (full length WE_Eng.png) */}
          <div className="we-brandbar" aria-label="WE Engineering">
            <div className="we-brandWordmarkWrap" aria-hidden="true">
              <img className="we-brandWordmark" src={weWordmark} alt="" />
            </div>
          </div>

          <div className="we-login-header">
            {/* ✅ replaced avatar with WE logo */}
            <div className="we-login-avatar" aria-hidden="true">
              <img src={weLogo} alt="" className="we-login-avatarImg" />
            </div>

            <div>
              <div className="we-login-kicker">Sign in</div>
              <div className="we-login-h1">Welcome back</div>
              <div className="we-login-sub">Clock in/out in seconds.</div>
            </div>
          </div>

          <form onSubmit={submit} className="we-login-form">
            <label className="we-login-label">
              Username
              <div className="we-input">
                <span className="we-icon" aria-hidden="true">
                  ⌨️
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. raj"
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="we-login-label">
              Password
              <div className="we-input">
                <span className="we-icon" aria-hidden="true">
                  🔒
                </span>
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
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <div className="we-login-row">
              <label className="we-check">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
              </label>

              <button
                type="button"
                className="we-link"
                onClick={() => alert("Ask admin to reset your password.")}
              >
                Forgot password?
              </button>
            </div>

            {err ? <div className="we-error">{err}</div> : null}

            <button type="submit" className="we-btn" disabled={!canSubmit}>
              {loading ? (
                <span className="we-btn-spin">
                  <span className="spinner" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="we-footer">
              <span className="we-pill">API</span>
              <span className="we-api">{apiBase() || "(same-origin)"}</span>
            </div>
          </form>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
/* (UNCHANGED CSS — your original styles) */
.we-login-root{
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  position:relative;
  overflow:hidden;
  background:#0b1220;
  color:#e5e7eb;
}

.we-login-bg{ position:absolute; inset:0; }
.we-login-blob{
  position:absolute;
  width:520px; height:520px;
  filter: blur(60px);
  opacity:.55;
  border-radius:999px;
}
.we-login-blob-1{ top:-180px; left:-160px; background: radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%); }
.we-login-blob-2{ bottom:-220px; right:-190px; background: radial-gradient(circle at 30% 30%, #22c55e, transparent 55%); }
.we-login-blob-3{ top:20%; right:-240px; background: radial-gradient(circle at 30% 30%, #06b6d4, transparent 55%); }

.we-login-noise{
  position:absolute; inset:0;
  opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.we-login-window{
  position:relative;
  width:min(420px, 100%);
  border-radius:22px;
  background: rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.16);
  box-shadow: 0 30px 80px rgba(0,0,0,.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow:hidden;
}

.we-login-titlebar{
  height:44px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 14px;
  border-bottom:1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
}

.we-login-dots{ display:flex; gap:8px; }
.dot{ width:12px; height:12px; border-radius:999px; display:inline-block; }
.dot-red{ background:#ff5f57; }
.dot-yellow{ background:#febc2e; }
.dot-green{ background:#28c840; }

.we-login-title{
  font-size:12px;
  letter-spacing:.4px;
  opacity:.85;
  user-select:none;
}

.we-login-content{ padding:18px 18px 16px; }

.we-brandbar{
  display:flex;
  align-items:center;
  padding:10px 12px;
  border-radius:16px;
  background: rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  margin-bottom:14px;
}

.we-brandWordmarkWrap{
  flex:1;
  min-width:0;
  height:42px;
  display:flex;
  align-items:center;
}

.we-brandWordmark{
  width:100%;
  height:100%;
  object-fit:contain;
  display:block;
  opacity:.95;
  filter: drop-shadow(0 10px 22px rgba(0,0,0,.18));
}

.we-login-header{
  display:flex;
  gap:12px;
  align-items:center;
  margin-bottom:14px;
}

.we-login-avatar{
  width:44px; height:44px;
  display:flex; align-items:center; justify-content:center;
  border-radius:14px;
  background: rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
  overflow:hidden;
}

.we-login-avatarImg{
  width:26px;
  height:26px;
  object-fit:contain;
  display:block;
}

.we-login-kicker{ font-size:12px; opacity:.75; }
.we-login-h1{ font-size:22px; font-weight:900; margin-top:2px; color:#fff; }
.we-login-sub{ font-size:13px; opacity:.78; margin-top:2px; }

.we-login-form{ display:grid; gap:12px; margin-top:10px; }

.we-login-label{
  font-size:12px;
  font-weight:700;
  opacity:.9;
  display:grid;
  gap:8px;
}

.we-input{
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 12px;
  border-radius:14px;
  background: rgba(15,23,42,.35);
  border:1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
}

.we-input input{
  width:100%;
  border:0;
  outline:none;
  background:transparent;
  color:#fff;
  font-size:14px;
}
.we-input input::placeholder{ color: rgba(226,232,240,.55); }

.we-icon{ opacity:.85; font-size:16px; }

.we-eye{
  border:0;
  background:transparent;
  color:#fff;
  opacity:.85;
  cursor:pointer;
  padding:4px 6px;
  border-radius:10px;
}
.we-eye:hover{ background: rgba(255,255,255,.08); }

.we-login-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin-top:2px;
}

.we-check{
  display:flex;
  gap:8px;
  align-items:center;
  font-size:12px;
  opacity:.85;
  user-select:none;
}

.we-link{
  border:0;
  background:transparent;
  color:#a5b4fc;
  font-size:12px;
  cursor:pointer;
  padding:6px 8px;
  border-radius:10px;
}
.we-link:hover{ background: rgba(165,180,252,.12); }

.we-error{
  background: rgba(244,63,94,.14);
  border:1px solid rgba(244,63,94,.28);
  color:#fecdd3;
  border-radius:14px;
  padding:10px 12px;
  font-size:12px;
  font-weight:700;
}

.we-btn{
  width:100%;
  border:0;
  border-radius:14px;
  padding:12px 14px;
  background: linear-gradient(135deg, rgba(99,102,241,1), rgba(236,72,153,1));
  color:#fff;
  font-weight:900;
  font-size:14px;
  cursor:pointer;
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .12s ease, opacity .12s ease;
}
.we-btn:hover{ filter: brightness(1.05); transform: translateY(-1px); }
.we-btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; }

.we-btn-spin{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
}
.spinner{
  width:16px;height:16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.5);
  border-top-color:#fff;
  animation:spin .9s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg);} }

.we-footer{
  margin-top:10px;
  display:flex;
  gap:10px;
  align-items:center;
  justify-content:center;
  font-size:12px;
  opacity:.8;
}
.we-pill{
  font-size:11px;
  font-weight:900;
  letter-spacing:.3px;
  background: rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  padding:4px 8px;
  border-radius:999px;
}
.we-api{
  max-width: 260px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

@media (max-width: 420px){
  .we-brandbar{
    padding:10px;
    gap:10px;
  }
  .we-brandWordmarkWrap{ height:38px; }
  .we-brandLogoWrap{ width:40px; height:40px; }
}
`;