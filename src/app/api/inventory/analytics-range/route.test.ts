import { beforeEach, describe, expect, it, vi } from "vitest";
const { getAppProfile, loadAnalyticsRange } = vi.hoisted(() => ({ getAppProfile: vi.fn(), loadAnalyticsRange: vi.fn() }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/inventory/data", () => ({ loadAnalyticsRange }));
import { GET } from "./route";

describe("analytics range endpoint", () => {
  beforeEach(() => { vi.resetAllMocks(); getAppProfile.mockResolvedValue({ role: "viewer" }); });
  it.each(["from=2026-02-30&to=2026-03-01", "from=2026-03-02&to=2026-03-01", "from=x&to=y", "from=2026-01-01&to=9999-01-01"])("rejects invalid range %s", async (query) => {
    expect((await GET(new Request(`https://inventory.example/api/inventory/analytics-range?${query}`))).status).toBe(400);
    expect(loadAnalyticsRange).not.toHaveBeenCalled();
  });
  it("authenticates before reading inventory and never caches private results", async () => {
    loadAnalyticsRange.mockResolvedValue({ history: [], fromSnapshotId: null, toSnapshotId: null });
    const response = await GET(new Request("https://inventory.example/api/inventory/analytics-range?from=2026-01-01&to=2026-02-01"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getAppProfile.mock.invocationCallOrder[0]).toBeLessThan(loadAnalyticsRange.mock.invocationCallOrder[0]);
  });
  it("stops when authentication fails", async () => {
    getAppProfile.mockRejectedValue(new Error("unauthorized"));
    await expect(GET(new Request("https://inventory.example/api/inventory/analytics-range?from=2026-01-01&to=2026-02-01"))).rejects.toThrow("unauthorized");
    expect(loadAnalyticsRange).not.toHaveBeenCalled();
  });
});
