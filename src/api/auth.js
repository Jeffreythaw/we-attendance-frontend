// src/api/auth.js
import { apiFetch } from "./client";

export async function login(username, password) {
  // Your backend expects { username, password }
  return apiFetch("/api/Auth/login", {
    method: "POST",
    auth: false,
    body: { username, password },
  });
}