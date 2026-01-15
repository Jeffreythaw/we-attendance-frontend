import { apiFetch } from "./client";

export const holidaysApi = {
  list() {
    return apiFetch("/api/Holidays", { method: "GET" });
  },
  create({ date, name }) {
    return apiFetch("/api/Holidays", { method: "POST", body: { date, name } });
  },
  remove(id) {
    return apiFetch(`/api/Holidays/${id}`, { method: "DELETE" });
  },
};