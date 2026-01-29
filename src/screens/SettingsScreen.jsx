// src/screens/SettingsScreen.jsx
import React from "react";

export function SettingsScreen({ user, onLogout }) {
  return (
    <div className="we-s-root">
      <div className="we-s-head">
        <div>
          <div className="we-s-kicker">Preferences</div>
          <div className="we-s-title">Settings</div>
          <div className="we-s-sub">Account and app info</div>
        </div>
      </div>

      <div className="we-glass-card">
        <div className="we-s-cardTitle">Account</div>
        <div className="we-s-cardSub">Signed in</div>

        <div className="we-s-list">
          <div className="we-s-row">
            <span className="we-s-key">Username</span>
            <span className="we-s-val">{user?.username || "—"}</span>
          </div>
          <div className="we-s-row">
            <span className="we-s-key">Role</span>
            <span className="we-s-val">{user?.role || "—"}</span>
          </div>
          <div className="we-s-row">
            <span className="we-s-key">EmployeeId</span>
            <span className="we-s-val">{user?.employeeId ?? "—"}</span>
          </div>
          {/* <div className="we-s-row">
            <span className="we-s-key">API</span>
            <span className="we-s-val we-s-api">{apiBase()}</span>
          </div> */}
        </div>

        <button className="we-s-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
.we-s-root{ display:grid; gap:12px; }
.we-s-kicker{ font-size:12px; opacity:.75; }
.we-s-title{ font-size:26px; font-weight:950; color:#fff; margin-top:2px; line-height:1.1; }
.we-s-sub{ margin-top:6px; font-size:12px; color: rgba(226,232,240,.75); }

.we-s-cardTitle{ font-weight:950; color:#fff; font-size:14px; }
.we-s-cardSub{ font-size:12px; color: rgba(226,232,240,.75); margin-top:2px; }

.we-s-list{ margin-top:12px; display:grid; gap:10px; }
.we-s-row{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:baseline;
  padding:10px 12px;
  border-radius:14px;
  background: rgba(15,23,42,.22);
  border:1px solid rgba(255,255,255,.12);
}
.we-s-key{ font-size:12px; font-weight:900; color: rgba(226,232,240,.75); }
.we-s-val{
  font-size:12px;
  color: rgba(226,232,240,.92);
  text-align:right;
  word-break: break-word;
}
.we-s-api{
  max-width: 280px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.we-s-logout{
  margin-top:14px;
  width:100%;
  border:0;
  border-radius:14px;
  padding:12px 14px;
  background: linear-gradient(135deg, rgba(244,63,94,1), rgba(236,72,153,1));
  color:#fff;
  font-weight:950;
  cursor:pointer;
  box-shadow: 0 14px 34px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .12s ease;
}
.we-s-logout:hover{ filter: brightness(1.05); transform: translateY(-1px); }
`;