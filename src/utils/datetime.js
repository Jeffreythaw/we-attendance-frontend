// src/utils/datetime.js

export function parseApiDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);

  const s = String(v).trim();

  // Already has timezone info => keep
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DDTHH:mm:ss(.fff)" => assume UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const d = new Date(s + "Z");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DD HH:mm:ss(.fff)" => assume UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const d = new Date(s.replace(" ", "T") + "Z");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

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