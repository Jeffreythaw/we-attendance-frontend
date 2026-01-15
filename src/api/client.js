// src/api/client.js

// ✅ use VITE_API_BASE_URL (recommended)
// set this on Vercel to: https://we-attendance-backend.onrender.com
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// used by UI (Login shows this)
export function apiBase() {
  return API_BASE;
}

// token helpers (match useAuth's localStorage key)
export function getToken() {
  try {
    return localStorage.getItem("we_token");
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (!token) localStorage.removeItem("we_token");
    else localStorage.setItem("we_token", token);
  } catch {
    // ignore
  }
}

export function clearAuth() {
  setToken(null);
  try {
    localStorage.removeItem("we_user");
  } catch {
    // ignore
  }
}

function joinUrl(base, path) {
  // If path is absolute already, just use it
  if (typeof path === "string" && /^https?:\/\//i.test(path)) return path;

  // If no base provided, fall back to same-origin (dev proxy etc.)
  if (!base) return path;

  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  const hasBody = body !== undefined;

  if (hasBody) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = joinUrl(API_BASE, path);

  const res = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = text ? JSON.parse(text) : null;
      msg = data?.message || data?.title || msg;
    } catch {
      msg = text || msg;
    }
    throw new Error(msg);
  }

  return text ? JSON.parse(text) : null;
}