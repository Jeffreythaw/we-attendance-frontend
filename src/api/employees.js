// src/api/employees.js
import { apiFetch } from "./client";

function normalizeEmployee(r) {
  if (!r) return r;

  return {
    id: r.id ?? r.Id,
    name: r.name ?? r.Name,
    department: r.department ?? r.Department,
    active: r.active ?? r.Active,
    createdAt: r.createdAt ?? r.CreatedAt,
  };
}

export async function listEmployees(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  const data = await apiFetch(`/api/Employees${qs}`, { auth: true });

  if (!Array.isArray(data)) return [];
  return data.map(normalizeEmployee);
}

export async function createEmployee({ name, department }) {
  const data = await apiFetch("/api/Employees", {
    method: "POST",
    auth: true,
    body: { name, department },
  });

  return normalizeEmployee(data);
}