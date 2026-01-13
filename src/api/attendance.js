import { api } from "./client";

export const attendanceApi = {
  open: () => api("/api/Attendance/open"),
  me: () => api("/api/Attendance/me"),
  checkIn: (note) =>
    api("/api/Attendance/checkin", { method: "POST", body: { note } }),
  checkOut: () => api("/api/Attendance/checkout", { method: "POST", body: {} }),

  // Admin helpers (only if your token is Admin)
  all: () => api("/api/Attendance/all"),
  byEmployee: (employeeId) => api(`/api/Attendance/employee/${employeeId}`),
};