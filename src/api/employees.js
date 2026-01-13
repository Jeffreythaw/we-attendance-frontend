// src/api/employees.js
import { apiFetch } from "./client";

export async function listEmployees() {
  return apiFetch("/api/Employees", { method: "GET" });
}

export async function createEmployee({ name, department, active = true }) {
  return apiFetch("/api/Employees", {
    method: "POST",
    body: { name, department, active },
  });
}

export async function deactivateEmployee(id) {
  // If your backend supports PUT/PATCH, adjust this path.
  // If not, tell me your EmployeesController endpoints and I’ll match it.
  return apiFetch(`/api/Employees/${id}/deactivate`, { method: "POST" });
}