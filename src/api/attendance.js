import { apiFetch } from "./client";

export const attendanceApi = {
  open() {
    return apiFetch("/api/Attendance/open", { method: "GET" });
  },

  me() {
    return apiFetch("/api/Attendance/me", { method: "GET" });
  },

  // ✅ holidays by year: GET /api/Holidays?year=2026
  holidays(year) {
    const y = Number(year) || new Date().getFullYear();
    return apiFetch(`/api/Holidays?year=${encodeURIComponent(y)}`, { method: "GET" });
  },

  // note + location
  checkIn(note, location) {
    return apiFetch("/api/Attendance/checkin", {
      method: "POST",
      body: { note: (note || "").trim(), location: location ?? null },
    });
  },

  // ✅ location + optional OT project
  checkOut(location, otProjectName, forceNoOt = false) {
    const project = (otProjectName || "").trim();
    const noOt = forceNoOt === true;

    return apiFetch("/api/Attendance/checkout", {
      method: "POST",
      body: {
        location: location ?? null,
        // send only if provided
        otProjectName: !noOt && project ? project : null,
        forceNoOt: noOt ? true : null,
      },
    });
  },

  adminGetLog(id) {
    return apiFetch(`/api/Attendance/log/${encodeURIComponent(id)}`, { method: "GET" });
  },

  adminEmployee(employeeId, from, to) {
    const qs =
      from && to
        ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        : "";
    return apiFetch(`/api/Attendance/employee/${encodeURIComponent(employeeId)}${qs}`, { method: "GET" });
  },

  adminRecalculateMinutes({ from, to, employeeId } = {}) {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (employeeId) qs.set("employeeId", String(employeeId));
    const query = qs.toString();
    const path = query
      ? `/api/Attendance/admin/recalculate-minutes?${query}`
      : "/api/Attendance/admin/recalculate-minutes";
    return apiFetch(path, { method: "POST" });
  },
};
