// src/api/users.js
import { apiFetch } from "./client";

export function createUser({ employeeId, username, password, role }) {
  return apiFetch("/api/Users", {
    method: "POST",
    auth: true,
    body: {
      employeeId: Number(employeeId),
      username: String(username || "").trim(),
      password: String(password || ""),
      role: String(role || "Employee"),
    },
  });
}

export function listUsers(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return apiFetch(`/api/Users${qs}`, { method: "GET", auth: true });
}

export function patchUser(id, payload) {
  return apiFetch(`/api/Users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}
