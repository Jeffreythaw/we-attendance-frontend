import { apiFetch } from "./client";

export async function login(username, password) {
  return apiFetch("/api/Auth/login", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
}