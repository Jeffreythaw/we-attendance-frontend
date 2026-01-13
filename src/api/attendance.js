// src/api/attendance.js
import { apiFetch } from "./client";

export async function checkIn(note) {
  return apiFetch("/api/Attendance/checkin", {
    method: "POST",
    body: { note: note || "" },
  });
}

export async function checkOut() {
  return apiFetch("/api/Attendance/checkout", {
    method: "POST",
    body: {},
  });
}

export async function myOpen() {
  return apiFetch("/api/Attendance/open");
}

export async function myHistory() {
  return apiFetch("/api/Attendance/me");
}

// ✅ Backward-compatible object export (if screens import attendanceApi)
export const attendanceApi = { checkIn, checkOut, myOpen, myHistory };