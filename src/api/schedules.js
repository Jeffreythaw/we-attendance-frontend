import { apiFetch } from "./client";

function withRange(path, from, to) {
  const qs = new URLSearchParams();
  qs.set("from", from);
  qs.set("to", to);
  return `${path}?${qs.toString()}`;
}

export const schedulesApi = {
  employees() {
    return apiFetch("/api/Schedules/employees", { method: "GET" });
  },

  list() {
    return apiFetch("/api/Schedules", { method: "GET" });
  },

  create(payload) {
    return apiFetch("/api/Schedules", { method: "POST", body: payload });
  },

  assign(payload) {
    return apiFetch("/api/Schedules/assign", { method: "POST", body: payload });
  },

  myCalendar(from, to) {
    return apiFetch(withRange("/api/Schedules/my-calendar", from, to), { method: "GET" });
  },

  calendar(from, to, employeeId) {
    const qs = new URLSearchParams();
    qs.set("from", from);
    qs.set("to", to);
    if (employeeId) qs.set("employeeId", String(employeeId));
    return apiFetch(`/api/Schedules/calendar?${qs.toString()}`, { method: "GET" });
  },

  entries(from, to, employeeId) {
    const qs = new URLSearchParams();
    qs.set("from", from);
    qs.set("to", to);
    if (employeeId) qs.set("employeeId", String(employeeId));
    return apiFetch(`/api/Schedules/entries?${qs.toString()}`, { method: "GET" });
  },

  createEntry(payload) {
    return apiFetch("/api/Schedules/entries", { method: "POST", body: payload });
  },

  createEntriesBulk(payload) {
    return apiFetch("/api/Schedules/entries/bulk", { method: "POST", body: payload });
  },

  updateEntry(id, payload) {
    return apiFetch(`/api/Schedules/entries/${encodeURIComponent(id)}`, { method: "PUT", body: payload });
  },

  deleteEntry(id) {
    return apiFetch(`/api/Schedules/entries/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  createRequest(payload) {
    return apiFetch("/api/Schedules/requests", { method: "POST", body: payload });
  },

  requests(status) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    const query = qs.toString();
    return apiFetch(query ? `/api/Schedules/requests?${query}` : "/api/Schedules/requests", { method: "GET" });
  },

  approveRequest(id, note) {
    return apiFetch(`/api/Schedules/requests/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: { note: note || "" },
    });
  },

  rejectRequest(id, note) {
    return apiFetch(`/api/Schedules/requests/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: { note: note || "" },
    });
  },
};
