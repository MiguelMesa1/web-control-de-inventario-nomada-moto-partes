import { describe, expect, it } from "vitest";
import { buildProductHistory } from "@/lib/inventory/product-history";
import type {
  InventoryHistoryPoint,
  InventorySnapshot,
} from "@/types/inventory";

function point(
  snapshotId: string,
  date: string,
  available: number,
): InventoryHistoryPoint {
  return {
    snapshotId,
    date,
    available,
    sku: "SKU-1",
    productLine: "Motor",
    warehouse: "Principal",
  };
}

describe("product history", () => {
  it("returns only loads where availability changed", () => {
    const history = [
      point("first", "2026-07-01T12:00:00.000Z", 10),
      point("same", "2026-07-08T12:00:00.000Z", 10),
      point("out", "2026-07-15T12:00:00.000Z", 6),
      point("in", "2026-07-22T12:00:00.000Z", 14),
    ];
    const snapshots: Pick<InventorySnapshot, "id" | "filename">[] = [
      { id: "first", filename: "carga-1.xlsx" },
      { id: "out", filename: "carga-3.xlsx" },
      { id: "in", filename: "carga-4.xlsx" },
    ];

    expect(buildProductHistory(history, null, snapshots)).toEqual({
      changes: 2,
      netChange: 4,
      events: [
        {
          snapshotId: "in",
          filename: "carga-4.xlsx",
          date: "2026-07-22T12:00:00.000Z",
          previousAvailable: 6,
          available: 14,
          change: 8,
          kind: "increase",
        },
        {
          snapshotId: "out",
          filename: "carga-3.xlsx",
          date: "2026-07-15T12:00:00.000Z",
          previousAvailable: 10,
          available: 6,
          change: -4,
          kind: "decrease",
        },
        {
          snapshotId: "first",
          filename: "carga-1.xlsx",
          date: "2026-07-01T12:00:00.000Z",
          previousAvailable: null,
          available: 10,
          change: null,
          kind: "initial",
        },
      ],
    });
  });

  it("replaces a historical value with the current snapshot value", () => {
    const history = [
      point("first", "2026-07-01T12:00:00.000Z", 10),
      point("current", "2026-07-29T12:00:00.000Z", 7),
    ];

    const result = buildProductHistory(
      history,
      {
        snapshotId: "current",
        sourceExportedAt: "2026-07-29T12:00:00.000Z",
        available: 5,
      },
      [],
    );

    expect(result.events[0]).toMatchObject({
      snapshotId: "current",
      previousAvailable: 10,
      available: 5,
      change: -5,
    });
  });
});
