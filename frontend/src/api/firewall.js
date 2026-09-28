import client from "./client";

export function inspect(payload) {
  return client.post("/firewall/inspect", payload).then((res) => res.data);
}
