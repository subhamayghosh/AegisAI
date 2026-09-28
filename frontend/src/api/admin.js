import client from "./client";

export function getMetrics() {
  return client.get("/admin/metrics").then((res) => res.data);
}

export function getEvents(n = 50) {
  return client.get("/admin/events", { params: { n } }).then((res) => res.data);
}

export function getAudit(params = {}) {
  return client.get("/admin/audit", { params }).then((res) => res.data);
}
