// src/api/users.js
import { apiFetch } from "./client";

export function createUser({ employeeId, username, password }) {
  return apiFetch("/api/Users", {
    method: "POST",
    auth: true,
    body: {
      employeeId: Number(employeeId),
      username: String(username || "").trim(),
      password: String(password || ""),
    },
  });
}