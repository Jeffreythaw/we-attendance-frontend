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

// ✅ support multiple token field names
function pickToken(data) {
  if (!data) return null;
  if (typeof data === "string") return data.trim() || null;

  return (
    data.token ||
    data.Token ||
    data.accessToken ||
    data.access_token ||
    null
  );
}

// ✅ support multiple user field names
function pickUser(data) {
  if (!data || typeof data !== "object") return null;
  return data.user || data.User || null;
}

// ✅ Decode JWT (base64url) so we can rebuild user when backend doesn't return it
function decodeJwt(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function buildUserFromJwt(token) {
  const payload = decodeJwt(token);
  if (!payload) return null;

  const username =
    payload.username ||
    payload.unique_name ||
    payload.name ||
    payload.sub ||
    "";

  const role =
    payload.role ||
    payload.roles ||
    payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
    "";

  const employeeId =
    payload.employeeId ||
    payload.EmployeeId ||
    payload["employeeId"] ||
    payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
    null;

  const finalRole = Array.isArray(role) ? role[0] : role;

  return {
    username: String(username || ""),
    role: String(finalRole || ""),
    employeeId: employeeId != null ? Number(employeeId) || employeeId : null,
  };
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

  const token = getToken();
  const isAuthed = !!token && !!user;

  async function login(username, password) {
    const data = await loginApi(username, password);

    const tokenValue = pickToken(data);
    if (!tokenValue) throw new Error("Login failed: token not returned.");

    setToken(tokenValue);

    const backendUser = pickUser(data);
    const finalUser = backendUser || buildUserFromJwt(tokenValue);
    if (!finalUser) {
      throw new Error(
        "Login failed: user not returned and JWT could not be decoded."
      );
    }

    lsSet(USER_KEY, JSON.stringify(finalUser));
    setUser(finalUser);
    return finalUser;
  }

  function logout() {
    setToken(null);
    lsSet(USER_KEY, null);
    setUser(null);
  }

  return { user, isAuthed, login, logout };
}