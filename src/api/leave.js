import { apiFetch, apiFetchBlob, apiFetchForm } from "./client";

export const leaveApi = {
  types() {
    return apiFetch("/api/Leave/types", { method: "GET" });
  },

  myLeaves() {
    return apiFetch("/api/Leave/me", { method: "GET" });
  },

  apply({ leaveTypeId, startDate, endDate, reason }) {
    return apiFetch("/api/Leave/apply", {
      method: "POST",
      body: {
        leaveTypeId,
        startDate,
        endDate,
        reason: reason || "",
      },
    });
  },

  applyWithFile({ leaveTypeId, startDate, endDate, reason, file }) {
    const formData = new FormData();
    formData.append("LeaveTypeId", String(leaveTypeId));
    formData.append("StartDate", startDate);
    formData.append("EndDate", endDate);
    if (reason) formData.append("Reason", reason);
    if (file) formData.append("Attachment", file);

    return apiFetchForm("/api/Leave/apply-with-file", { method: "POST", formData });
  },

  cancel(id) {
    return apiFetch(`/api/Leave/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  },

  downloadAttachment(id) {
    return apiFetchBlob(`/api/Leave/${encodeURIComponent(id)}/attachment`, { method: "GET" });
  },
};
