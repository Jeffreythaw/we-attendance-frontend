export const SUMMARY_ENDPOINT = "/api/AdminDashboard/summary";
export const PATCH_LOG_ENDPOINT = (id) => `/api/Attendance/log/${id}`;
export const REPORT_ENDPOINT = "/api/Reports/attendance";
export const INSIGHTS_ENDPOINT = "/api/Reports/insights";

export const DISPLAY_TZ = import.meta.env.VITE_DISPLAY_TZ || undefined;
// If you force Singapore TZ, we can safely convert datetime-local using +08:00 (no DST).
export const FIXED_OFFSET = DISPLAY_TZ === "Asia/Singapore" ? "+08:00" : null;