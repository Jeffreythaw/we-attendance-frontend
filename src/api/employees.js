import { apiFetch } from "./client";

export function createEmployee({ name, department, active = true }) {
  return apiFetch("/api/Employees", {
    method: "POST",
    body: { name, department, active },
  });
}

export function listEmployees() {
  return apiFetch("/api/Employees", { method: "GET" });
}

export function deactivateEmployee(id) {
  // If your backend uses PUT/PATCH endpoints, adjust this.
  // Example assumes PUT /api/Employees/{id}/deactivate exists.
  return apiFetch(`/api/Employees/${id}/deactivate`, { method: "PUT" });
}