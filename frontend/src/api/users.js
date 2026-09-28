import client from "./client";

export function getSettings() {
  return client.get("/users/me/settings").then((res) => res.data);
}

export function updateSettings(payload) {
  return client.put("/users/me/settings", payload).then((res) => res.data);
}

export function getAvailableModels() {
  return client.get("/users/me/settings/available-models").then((res) => res.data);
}

export function changePassword(payload) {
  return client.post("/users/me/password", payload).then((res) => res.data);
}

export function updateProfile(payload) {
  return client.patch("/users/me", payload).then((res) => res.data);
}
