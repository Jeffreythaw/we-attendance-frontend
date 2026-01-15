import { apiFetch } from "./client";

export const attendanceApi = {
  open() {
    return apiFetch("/api/Attendance/open", { method: "GET" });
  },

  me() {
    return apiFetch("/api/Attendance/me", { method: "GET" });
  },

  // note + location
  checkIn(note, location) {
    return apiFetch("/api/Attendance/checkin", {
      method: "POST",
      body: { note: (note || "").trim(), location: location ?? null },
    });
  },

  // location only
  checkOut(location) {
    return apiFetch("/api/Attendance/checkout", {
      method: "POST",
      body: { location: location ?? null },
    });
  },
};