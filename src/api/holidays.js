import { apiFetch } from "./client";

function normalizeYear(year) {
  const y = Number(year);
  return Number.isFinite(y) && y > 0 ? y : new Date().getFullYear();
}

export const holidaysApi = {
  // ✅ GET /api/Holidays?year=2026
  list(year) {
    const y = normalizeYear(year);
    return apiFetch(`/api/Holidays?year=${encodeURIComponent(y)}`, { method: "GET" });
  },

  // ✅ POST /api/Holidays  { date: "2026-01-01", name: "..." }
  create({ date, name }) {
    return apiFetch("/api/Holidays", {
      method: "POST",
      body: {
        date: String(date || "").slice(0, 10), // expects "YYYY-MM-DD"
        name: (name || "").trim(),
      },
    });
  },

  // ✅ DELETE /api/Holidays/123
  remove(id) {
    return apiFetch(`/api/Holidays/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};