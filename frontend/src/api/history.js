import client from "./client";

export function listHistory(params = {}) {
  return client.get("/history", { params }).then((res) => res.data);
}

export function getHistoryItem(id) {
  return client.get(`/history/${id}`).then((res) => res.data);
}

export function deleteHistoryItem(id) {
  return client.delete(`/history/${id}`).then((res) => res.data);
}

export function clearHistory() {
  return client.delete("/history").then((res) => res.data);
}
