import { api } from "./client";

export async function login(username, password) {
  return api("/api/Auth/login", {
    method: "POST",
    body: { username, password },
  });
}