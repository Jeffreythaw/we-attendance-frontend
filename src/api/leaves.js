import { apiFetch } from "./client";

export const leavesApi = {
  listRequests(status = "Pending") {
    return apiFetch(`/api/Leave/requests?status=${encodeURIComponent(status)}`, { method: "GET" });
  },
  approve(id) {
    return apiFetch(`/api/Leave/requests/${id}/approve`, { method: "POST", body: {} });
  },
  reject(id, reason = "") {
    return apiFetch(`/api/Leave/requests/${id}/reject`, {
      method: "POST",
      body: { reason },
    });
  },
};