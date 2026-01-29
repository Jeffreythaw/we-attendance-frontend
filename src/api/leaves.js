import { apiFetch } from "./client";

export const leavesApi = {
  // ✅ GET /api/Leave/requests?status=Pending
  listRequests(status = "Pending") {
    const s = String(status || "Pending").trim() || "Pending";
    return apiFetch(`/api/Leave/requests?status=${encodeURIComponent(s)}`, {
      method: "GET",
    });
  },

  // ✅ POST /api/Leave/requests/{id}/approve
  approve(id) {
    return apiFetch(`/api/Leave/requests/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: {},
    });
  },

  // ✅ POST /api/Leave/requests/{id}/reject  { reason: "..." }
  reject(id, reason = "") {
    return apiFetch(`/api/Leave/requests/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: { reason: String(reason || "").trim() },
    });
  },
};