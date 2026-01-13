// src/hooks/useAuth.js
import { useState } from "react";
import { login as loginApi } from "../api/auth";
import { setToken, clearAuth, getToken } from "../api/client";

function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key, val) {
  try {
    if (val === null || val === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

export function useAuth() {
  const [user, setUser] = useState(() => {
    const s = lsGet("we_user");
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  });

  const isAuthed = !!getToken() && !!user;

  async function login(username, password) {
    const data = await loginApi(username, password); // { token, user }
    setToken(data.token);
    lsSet("we_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearAuth();
    setUser(null);
  }

  return { user, isAuthed, login, logout };
}