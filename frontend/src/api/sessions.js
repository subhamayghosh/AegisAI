import client from "./client";

export function listSessions(params = {}) {
  return client.get("/sessions", { params }).then((res) => res.data);
}

export function getSession(sessionId) {
  return client.get(`/sessions/${sessionId}`).then((res) => res.data);
}
