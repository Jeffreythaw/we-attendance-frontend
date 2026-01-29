import { apiFetch } from "./client";

export const leaveTypesApi = {
  list() {
    return apiFetch("/api/LeaveTypes", { method: "GET" });
  },

  create({ code, name, paid = false, active = true }) {
    return apiFetch("/api/LeaveTypes", {
      method: "POST",
      body: {
        code: (code || "").trim(),
        name: (name || "").trim(),
        paid: !!paid,
        active: !!active,
      },
    });
  },

  update(id, patch) {
    return apiFetch(`/api/LeaveTypes/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: patch || {},
    });
  },

  remove(id) {
    return apiFetch(`/api/LeaveTypes/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};