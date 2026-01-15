const API_BASE = import.meta.env.VITE_API_BASE;

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
  if (!base) return path;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};

  // Only set JSON content-type if we actually send a body
  const hasBody = body !== undefined;

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(joinUrl(API_BASE, path), {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const data = text ? JSON.parse(text) : null;
      msg = data?.message || data?.title || msg;
    } catch {
      msg = text || msg;
    }
    throw new Error(msg);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}