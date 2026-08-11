import { describe, expect, it } from "vitest";
import {
  aggregateLineMetrics,
  buildInventoryTrend,
  calculateProductMovements,
  inventorySummary,
  summarizeNegativeMovementsByLine,
} from "@/lib/inventory/analytics";
import type { InventoryHistoryPoint, InventoryItem } from "@/types/inventory";

const item = (
  sku: string,
  productLine: string,
  warehouse: string,
  available: number,
): InventoryItem => ({
  sku,
  productName: `Producto ${sku}`,
  productLine,
  warehouse,
  stock: available,
  reserved: 0,
  available,
  sourceExportedAt: "2026-07-29T12:00:00.000Z",
});

describe("inventory analytics", () => {
  it("aggregates references and variation by line", () => {
    const current = [
      item("A", "Frenos", "Principal", 8),
      item("A", "Frenos", "Norte", 2),
      item("B", "Frenos", "Principal", 0),
    ];
    const previous = [
      item("A", "Frenos", "Principal", 4),
      item("A", "Frenos", "Norte", 1),
      item("B", "Frenos", "Principal", 5),
    ];

    expect(aggregateLineMetrics(current, previous, 5)).toEqual([
      {
        line: "Frenos",
        available: 10,
        references: 2,
        exhausted: 1,
        lowStock: 1,
        change: 0,
        changePercent: 0,
      },
    ]);
  });

  it("compares products by SKU and warehouse without calling changes sales", () => {
    const movements = calculateProductMovements(
      [item("A", "Motor", "Principal", 7)],
      [item("A", "Motor", "Principal", 10)],
    );
    expect(movements[0]).toMatchObject({
      sku: "A",
      warehouse: "Principal",
      previous: 10,
      current: 7,
      change: -3,
      changePercent: -30,
    });
  });

  it("summarizes only negative movements by product line", () => {
    const movements = calculateProductMovements(
      [
        item("A", "Motor", "Principal", 7),
        item("B", "Motor", "Principal", 3),
        item("C", "Frenos", "Principal", 12),
      ],
      [
        item("A", "Motor", "Principal", 10),
        item("B", "Motor", "Principal", 8),
        item("C", "Frenos", "Principal", 10),
      ],
    );

    expect(summarizeNegativeMovementsByLine(movements)).toEqual([
      { line: "Motor", unitsOut: 8, products: 2 },
    ]);
  });

  it("summarizes exhausted and low stock independently", () => {
    expect(
      inventorySummary(
        [
          item("A", "Motor", "Principal", 0),
          item("B", "Frenos", "Principal", 5),
          item("C", "Frenos", "Principal", 9),
        ],
        5,
      ),
    ).toEqual({
      references: 3,
      available: 14,
      exhausted: 1,
      lowStock: 1,
      lines: 2,
    });
  });

  it("builds a chronological inventory trend and respects selected lines", () => {
    const history: InventoryHistoryPoint[] = [
      {
        date: "2026-07-01T12:00:00.000Z",
        snapshotId: "first",
        productLine: "Motor",
        warehouse: "Principal",
        sku: "A",
        available: 10,
      },
      {
        date: "2026-07-01T12:00:00.000Z",
        snapshotId: "first",
        productLine: "Frenos",
        warehouse: "Principal",
        sku: "B",
        available: 8,
      },
    ];
    const current = [
      { ...item("A", "Motor", "Principal", 7), snapshotId: "current" },
      { ...item("B", "Frenos", "Principal", 12), snapshotId: "current" },
    ];

    expect(buildInventoryTrend(history, current, ["Motor"])).toEqual([
      {
        snapshotId: "first",
        date: "2026-07-01T12:00:00.000Z",
        available: 10,
      },
      {
        snapshotId: "current",
        date: "2026-07-29T12:00:00.000Z",
        available: 7,
      },
    ]);
  });
});
