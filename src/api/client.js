// src/api/client.js

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export function apiBase() {
  return API_BASE;
}

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

// Main fetch helper
export async function apiFetch(
  path,
  { method = "GET", body, auth = true, headers: extraHeaders } = {}
) {
  const headers = {
    ...(extraHeaders || {}),
  };

  // Only set JSON header when we actually send a body
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Read body ONCE (fixes "body stream already read")
  const text = await res.text();
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = text ? (isJson ? safeJsonParse(text) : text) : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.title)) ||
      (typeof data === "string" ? data : null) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ✅ Backward-compatible alias so old imports "api" still work
export const api = apiFetch;