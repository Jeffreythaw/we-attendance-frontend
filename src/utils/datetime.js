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

// If you display in Singapore time, we can safely interpret "timezone-less" timestamps as +08:00
function getFixedOffsetForDisplayTz(tz) {
  // Singapore has no DST => always +08:00
  if (tz === "Asia/Singapore") return "+08:00";
  return null;
}

export function parseApiDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);

  const s = String(v).trim();
  if (!s) return null;

  // If string already has timezone info => parse as-is
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const tz = getDisplayTz();
  const fixedOffset = getFixedOffsetForDisplayTz(tz);

  // Date-only "YYYY-MM-DD"
  // Interpret as midnight in display TZ if fixed offset exists, otherwise let browser handle it.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const iso = fixedOffset ? `${s}T00:00:00${fixedOffset}` : `${s}T00:00:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DDTHH:mm:ss(.fff)" (no timezone)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    // IMPORTANT: previously you added "Z" (UTC) which caused +8h shift for SG-local stored values.
    const iso = fixedOffset ? `${s}${fixedOffset}` : s; // fallback: browser local
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DD HH:mm:ss(.fff)" (no timezone)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const t = s.replace(" ", "T");
    const iso = fixedOffset ? `${t}${fixedOffset}` : t; // fallback: browser local
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fallback
  const d = new Date(s);
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