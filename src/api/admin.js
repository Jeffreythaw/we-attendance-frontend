import { apiFetch } from "./client";

export function getAdminSummary(from, to) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return apiFetch(`/api/AdminDashboard/summary?${qs.toString()}`, { method: "GET" });
}