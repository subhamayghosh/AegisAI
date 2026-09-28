import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPost = vi.fn();
const requestUse = vi.fn();
const responseUse = vi.fn();

function mockInstance(config) {
  return mockInstance._retryImpl(config);
}
mockInstance.interceptors = {
  request: { use: requestUse },
  response: { use: responseUse },
};
mockInstance._retryImpl = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: () => mockInstance,
    post: (...args) => mockPost(...args),
  },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("api client 401 refresh-and-retry", () => {
  it("refreshes the access token once on 401 and retries the original request", async () => {
    const { setAccessTokenRef } = await import("../src/api/client");
    const tokenRef = { current: "expired-access" };
    setAccessTokenRef(tokenRef);

    localStorage.setItem("refresh_token", "old-refresh");
    mockPost.mockResolvedValue({
      data: { access_token: "new-access", refresh_token: "new-refresh" },
    });
    mockInstance._retryImpl.mockResolvedValue({ data: "retried-ok" });

    const rejectedHandler = responseUse.mock.calls[0][1];
    const originalConfig = { headers: {}, _retried: undefined };

    const result = await rejectedHandler({
      response: { status: 401 },
      config: originalConfig,
    });

    expect(mockPost).toHaveBeenCalledWith("/api/auth/refresh", {
      refresh_token: "old-refresh",
    });
    expect(localStorage.getItem("refresh_token")).toBe("new-refresh");
    expect(originalConfig.headers.Authorization).toBe("Bearer new-access");
    expect(originalConfig._retried).toBe(true);
    expect(mockInstance._retryImpl).toHaveBeenCalledWith(originalConfig);
    expect(result).toEqual({ data: "retried-ok" });
  });

  it("logs the user out when the refresh call itself fails", async () => {
    const { setAccessTokenRef, setOnAuthFailure } = await import(
      "../src/api/client"
    );
    setAccessTokenRef({ current: "expired-access" });
    const onAuthFailure = vi.fn();
    setOnAuthFailure(onAuthFailure);

    localStorage.setItem("refresh_token", "old-refresh");
    mockPost.mockRejectedValue(new Error("refresh failed"));

    const rejectedHandler = responseUse.mock.calls[0][1];
    const originalConfig = { headers: {}, _retried: undefined };

    await expect(
      rejectedHandler({ response: { status: 401 }, config: originalConfig })
    ).rejects.toThrow();

    expect(onAuthFailure).toHaveBeenCalled();
  });
});
