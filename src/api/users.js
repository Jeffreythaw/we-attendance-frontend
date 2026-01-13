import { apiFetch } from "./client";

export function createEmployeeUser({ employeeId, username, password }) {
  return apiFetch("/api/Users", {
    method: "POST",
    auth: true,
    body: { employeeId, username, password },
  });
}