// src/api/employees.js
import { apiFetch } from "./client";

function normalizeEmployee(r) {
  if (!r) return r;

  return {
    id: r.id ?? r.Id,
    name: r.name ?? r.Name,
    department: r.department ?? r.Department,
    active: r.active ?? r.Active ?? true,
    createdAt: r.createdAt ?? r.CreatedAt,

    finNo: r.finNo ?? r.FinNo,
    nationality: r.nationality ?? r.Nationality,
    dateOfBirth: r.dateOfBirth ?? r.DateOfBirth,

    workPermitNo: r.workPermitNo ?? r.WorkPermitNo,
    workPermitExpiry: r.workPermitExpiry ?? r.WorkPermitExpiry,

    bcssCsocNo: r.bcssCsocNo ?? r.BcssCsocNo,
    csocExpiryDate: r.csocExpiryDate ?? r.CsocExpiryDate,

    boomLiftExpiryDate: r.boomLiftExpiryDate ?? r.BoomLiftExpiryDate,
    scissorLiftExpiryDate: r.scissorLiftExpiryDate ?? r.ScissorLiftExpiryDate,
  };
}

export async function listEmployees(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  const data = await apiFetch(`/api/Employees${qs}`, { auth: true });
  if (!Array.isArray(data)) return [];
  return data.map(normalizeEmployee);
}

export async function createEmployee(payload) {
  const data = await apiFetch("/api/Employees", {
    method: "POST",
    auth: true,
    body: payload,
  });
  return normalizeEmployee(data);
}