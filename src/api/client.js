// src/api/client.js

// Prefer explicit VITE_API_BASE_URL, then legacy keys used across environments.
// Keep "" (same-origin) as final fallback for reverse-proxy deployments.
function cleanBase(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function uniqueBases(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    const c = cleanBase(v);
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function isLikelyLocalHost() {
  if (typeof window === "undefined") return false;
  const h = String(window.location?.hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".local");
}

const CONFIGURED_BASES = uniqueBases([
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_KJ_API_BASE,
  import.meta.env.VITE_API_BASE,
]);

const sameOriginFallbackAllowed =
  String(import.meta.env.VITE_API_ALLOW_SAME_ORIGIN_FALLBACK || "").toLowerCase() === "true" ||
  !!import.meta.env.DEV ||
  isLikelyLocalHost() ||
  CONFIGURED_BASES.length === 0;

const API_BASES = sameOriginFallbackAllowed
  ? uniqueBases([...CONFIGURED_BASES, ""])
  : CONFIGURED_BASES;

const API_BASE = API_BASES[0] || "";

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

function shouldRetryOrFallback(path, method, statusOrNull, errorMessage) {
  const m = String(method || "GET").toUpperCase();
  const p = String(path || "");
  const status = Number(statusOrNull);
  const isNetworkLike =
    status === 0 ||
    Number.isNaN(status) ||
    String(errorMessage || "").toLowerCase().includes("failed to fetch");
  const isTransientHttp = status === 502 || status === 503 || status === 504;

  const isIdempotent = m === "GET" || m === "HEAD" || m === "OPTIONS";
  const isLogin = p.toLowerCase() === "/api/auth/login";

  return (isIdempotent || isLogin) && (isNetworkLike || isTransientHttp);
}

function toError(text, status) {
  let msg = `HTTP ${status}`;
  try {
    const data = text ? JSON.parse(text) : null;
    msg = data?.message || data?.title || msg;
  } catch {
    msg = text || msg;
  }
  if (status === 503 && (!msg || msg === "HTTP 503")) {
    msg = "Service is temporarily unavailable. Please try again shortly.";
  }
  const err = new Error(msg);
  err.status = status;
  return err;
}

async function requestWithFallback(path, options = {}) {
  const { method = "GET", headers, body } = options;
  let lastError = null;

  for (let i = 0; i < API_BASES.length; i += 1) {
    const base = API_BASES[i];
    const url = joinUrl(base, path);
    try {
      const res = await fetch(url, { method, headers, body });
      if (res.ok) return res;

      const text = await res.text().catch(() => "");

      const err = toError(text, res.status);
      const canTryNext =
        i < API_BASES.length - 1 &&
        shouldRetryOrFallback(path, method, res.status, err.message);
      if (canTryNext) {
        lastError = err;
        continue;
      }
      throw err;
    } catch (e) {
      const canTryNext =
        i < API_BASES.length - 1 &&
        shouldRetryOrFallback(path, method, e?.status || 0, e?.message);
      if (canTryNext) {
        lastError = e instanceof Error ? e : new Error(String(e || "Request failed"));
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error("Request failed");
}

export async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  const hasBody = body !== undefined;

  if (hasBody) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await requestWithFallback(path, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();

  return text ? JSON.parse(text) : null;
}


export async function apiFetchForm(path, { method = "POST", formData, auth = true } = {}) {
  const headers = {};

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await requestWithFallback(path, {
    method,
    headers,
    body: formData,
  });
  const text = await res.text();

  return text ? JSON.parse(text) : null;
}

/* =========================================================
   ✅ ADD THESE for Reports (CSV download / preview)
   ========================================================= */

export async function apiFetchText(path, { method = "GET", auth = true } = {}) {
  const headers = {};

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await requestWithFallback(path, { method, headers });
  const text = await res.text();

  return text || "";
}

export async function apiFetchBlob(path, { method = "GET", auth = true } = {}) {
  const headers = {};

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await requestWithFallback(path, { method, headers });

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition") || "";
  const contentType = res.headers.get("content-type") || "";

  return { blob, contentDisposition, contentType };
}
