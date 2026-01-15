import { apiFetch } from "./client";

export const leaveTypesApi = {
  list() {
    return apiFetch("/api/LeaveTypes", { method: "GET" });
  },
  create({ code, name, paid, active }) {
    return apiFetch("/api/LeaveTypes", {
      method: "POST",
      body: { code, name, paid, active },
    });
  },
  update(id, patch) {
    return apiFetch(`/api/LeaveTypes/${id}`, { method: "PUT", body: patch });
  },
  remove(id) {
    return apiFetch(`/api/LeaveTypes/${id}`, { method: "DELETE" });
  },
};