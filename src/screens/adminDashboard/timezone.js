import { DISPLAY_TZ, FIXED_OFFSET } from "./constants";

export function toIsoRangeParams(fromDateStr, toDateStr) {
  const qs = new URLSearchParams();

  if (fromDateStr) {
    const d = new Date(`${fromDateStr}T00:00:00`);
    qs.set("from", d.toISOString());
  }
  if (toDateStr) {
    const d = new Date(`${toDateStr}T00:00:00`);
    d.setHours(23, 59, 59, 999);
    qs.set("to", d.toISOString());
  }

  return qs;
}

/** Convert server ISO time -> datetime-local string (YYYY-MM-DDTHH:mm) for the UI TZ */
export function isoToDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const y = get("year");
  const m = get("month");
  const day = get("day");
  const hh = get("hour");
  const mm = get("minute");

  if (!y || !m || !day || !hh || !mm) return "";
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * Convert datetime-local string -> DateTimeOffset string.
 * If DISPLAY_TZ is Asia/Singapore => append +08:00
 * else fallback: interpret as browser local -> send UTC ISO "Z"
 */
export function dateTimeLocalToOffsetString(dtLocal) {
  if (!dtLocal) return null;
  const withSeconds = dtLocal.length === 16 ? `${dtLocal}:00` : dtLocal;

  if (FIXED_OFFSET) return `${withSeconds}${FIXED_OFFSET}`;

  const d = new Date(withSeconds);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ----- grouping recent activity by day (in DISPLAY_TZ) ----- */
export function dayKeyFromLog(a) {
  const v = a?.checkInAt || a?.createdAt || a?.checkOutAt;
  if (!v) return "Unknown";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Unknown";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return y && m && day ? `${y}-${m}-${day}` : "Unknown";
}

export function dayLabelFromKey(key) {
  if (!key || key === "Unknown") return "Unknown day";
  const d = new Date(`${key}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: DISPLAY_TZ,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}