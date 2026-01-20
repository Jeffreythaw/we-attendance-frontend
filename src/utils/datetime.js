// src/utils/datetime.js

// Priority:
// 1) localStorage (optional UI setting)
// 2) VITE_DISPLAY_TZ (build-time)
// 3) browser timezone
function getDisplayTz() {
  const ls = (() => {
    try {
      return localStorage.getItem("we_tz");
    } catch {
      return null;
    }
  })();

  if (ls && ls !== "auto") return ls;

  const env = import.meta.env.VITE_DISPLAY_TZ;
  if (env && env !== "auto") return env;

  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// If you're displaying in Singapore, we can safely assume +08:00 (no DST)
function getFixedOffsetForTz(tz) {
  if (tz === "Asia/Singapore") return "+08:00";
  return null;
}

// Normalize "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DDTHH:mm:00"
function ensureSeconds(isoLike) {
  if (!isoLike) return isoLike;
  // 2026-01-19T08:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(isoLike)) return `${isoLike}:00`;
  // 2026-01-19 08:00
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(isoLike)) return `${isoLike}:00`;
  return isoLike;
}

export function parseApiDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);

  const s0 = String(v).trim();
  if (!s0) return null;

  const tz = getDisplayTz();
  const fixedOffset = getFixedOffsetForTz(tz);

  // If already has timezone info => keep as-is
  // Examples: ...Z, ...+08:00, ...-05:00
  if (/[zZ]$/.test(s0) || /[+-]\d{2}:\d{2}$/.test(s0)) {
    const d = new Date(s0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DateOnly: "YYYY-MM-DD"
  // Treat as midnight in display timezone (or browser local if no fixed offset)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s0)) {
    const iso = fixedOffset ? `${s0}T00:00:00${fixedOffset}` : `${s0}T00:00:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Datetime without timezone:
  // "YYYY-MM-DDTHH:mm:ss(.fff)" OR "YYYY-MM-DD HH:mm:ss(.fff)"
  // IMPORTANT: your DB values are Singapore-local, so append +08:00 (NOT Z) when tz is Asia/Singapore
  const s1 = ensureSeconds(s0);

  // Convert "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
  const s2 = /^\d{4}-\d{2}-\d{2} \d/.test(s1) ? s1.replace(" ", "T") : s1;

  // If we have fixed offset (Asia/Singapore), interpret as that local time
  if (fixedOffset) {
    const d = new Date(`${s2}${fixedOffset}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Otherwise: fallback (browser will interpret as local)
  const d = new Date(s2);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(v) {
  const d = parseApiDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: getDisplayTz(),
  }).format(d);
}

export function fmtDateOnly(v) {
  const d = parseApiDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: getDisplayTz(),
  }).format(d);
}