import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/insforge/authenticated-server", () => ({ createAuthenticatedInsForgeServerClient: createClient }));
vi.mock("@/lib/insforge/config", () => ({ isInsForgeConfigured: () => true }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeAdminClient: vi.fn() }));

import { loadAnalyticsData, loadAnalyticsRange } from "./data";

const snapshot = (id: string, date: string) => ({ id, source_exported_at: date, created_at: date, item_count: 1 });
const row = (id: string, available: number) => ({ snapshot_id: id, sku: "SKU", warehouse: "Principal", product_line: "Motor",
  product_name: "Producto", stock: available, reserved: 0, available, recorded_at: "2026-08-25T05:00:00Z", source_exported_at: "2026-08-25T05:00:00Z" });

function databaseFixture(snapshots: ReturnType<typeof snapshot>[]) {
  const historyIds: string[] = [];
  const rpc = vi.fn(() => ({ range: vi.fn().mockResolvedValue({ data: [row("current", 7)], error: null }) }));
  const from = vi.fn((table: string) => {
    let id: string | undefined;
    let before = "9999";
    const query = {
      select: vi.fn(() => query),
      order: vi.fn(() => query),
      eq: vi.fn((_column: string, value: string) => { id = value; return query; }),
      lte: vi.fn((_column: string, value: string) => { before = value; return query; }),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: snapshots.find((s) => Date.parse(s.source_exported_at) <= Date.parse(before)) ?? null, error: null })),
      range: vi.fn(async () => {
        if (table === "inventory_current") return { data: [row("current", 7)], error: null };
        historyIds.push(id!);
        return { data: [row(id!, 10)], error: null };
      }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: snapshots, error: null }).then(resolve),
    };
    return query;
  });
  createClient.mockResolvedValue({ database: { from, rpc } });
  return { historyIds, rpc };
}

describe("analytics data volume", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads only the previous snapshot and grouped trend, even for same-day imports", async () => {
    const fixture = databaseFixture([snapshot("current", "2026-08-25T05:00:00Z"), snapshot("previous", "2026-08-25T05:00:00Z"), snapshot("old", "2026-08-01T05:00:00Z")]);
    const data = await loadAnalyticsData();
    expect(fixture.historyIds).toEqual(["previous"]);
    expect(fixture.rpc).toHaveBeenCalledWith("inventory_analytics_trend", {});
    expect(data.history[0].snapshotId).toBe("previous");
    expect(data.trend).toHaveLength(1);
  });

  it("does not compare the first import against itself", async () => {
    const fixture = databaseFixture([snapshot("current", "2026-08-25T05:00:00Z")]);
    expect((await loadAnalyticsData()).history).toEqual([]);
    expect(fixture.historyIds).toEqual([]);
  });

  it("loads a single immutable snapshot when both dates select the same import", async () => {
    const fixture = databaseFixture([snapshot("previous", "2026-08-25T05:00:00Z")]);
    const result = await loadAnalyticsRange("2026-08-25", "2026-08-26");
    expect(fixture.historyIds).toEqual(["previous"]);
    expect(result.fromSnapshotId).toBe(result.toSnapshotId);
  });

  it("does not substitute a later snapshot when no inventory existed at the start date", async () => {
    databaseFixture([snapshot("previous", "2026-08-25T05:00:00Z")]);
    const result = await loadAnalyticsRange("2026-08-01", "2026-08-26");
    expect(result.fromSnapshotId).toBeNull();
    expect(result.toSnapshotId).toBe("previous");
  });
});
