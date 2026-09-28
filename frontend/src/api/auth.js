import client from "./client";

export function register({ email, password, display_name }) {
  return client
    .post("/auth/register", { email, password, display_name })
    .then((res) => res.data);
}

export function login({ email, password }) {
  return client.post("/auth/login", { email, password }).then((res) => res.data);
}

export function refresh(refresh_token) {
  return client.post("/auth/refresh", { refresh_token }).then((res) => res.data);
}

export function logout() {
  return client.post("/auth/logout").then((res) => res.data);
}

export function getMe() {
  return client.get("/users/me").then((res) => res.data);
}
