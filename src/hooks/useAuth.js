// src/hooks/useAuth.js
import { useState } from "react";
import { login as loginApi } from "../api/auth";
import { getToken, setToken } from "../api/client";

const USER_KEY = "we_user";

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
    const s = lsGet(USER_KEY);
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  });

  const isAuthed = !!getToken() && !!user;

  async function login(username, password) {
    const data = await loginApi(username, password);
    setToken(data.token);
    lsSet(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    lsSet(USER_KEY, null);
    setUser(null);
  }

  return { user, isAuthed, login, logout };
}