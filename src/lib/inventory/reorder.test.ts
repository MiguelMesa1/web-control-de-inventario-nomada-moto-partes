import { describe, expect, it } from "vitest";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import type { InventoryItem, ReorderWatchItem } from "@/types/inventory";

const watch = (sku: string, reorderPoint = 10): ReorderWatchItem => ({
  id: sku,
  sku,
  productName: `Producto ${sku}`,
  reorderPoint,
  active: true,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
});

const stock = (sku: string, available: number, warehouse: string): InventoryItem => ({
  sku,
  productName: `Producto ${sku}`,
  productLine: "Prueba",
  warehouse,
  stock: available,
  reserved: 0,
  available,
  sourceExportedAt: "2026-07-29T00:00:00.000Z",
});

describe("buildReorderAlertRows", () => {
  it("suma la disponibilidad del SKU entre bodegas", () => {
    const [row] = buildReorderAlertRows(
      [watch("A")],
      [stock("A", 6, "Principal"), stock("A", 7, "Norte")],
    );
    expect(row.available).toBe(13);
    expect(row.status).toBe("healthy");
    expect(row.productLine).toBe("Prueba");
  });

  it("activa el punto de reorden cuando quedan 10 o menos", () => {
    const [row] = buildReorderAlertRows([watch("A")], [stock("A", 10, "Principal")]);
    expect(row.status).toBe("reorder");
    expect(row.deficit).toBe(0);
  });

  it("distingue agotados de referencias ausentes en la carga", () => {
    const rows = buildReorderAlertRows(
      [watch("agotado"), watch("ausente")],
      [stock("agotado", 0, "Principal")],
    );
    expect(rows.map((row) => row.status)).toEqual(["exhausted", "missing"]);
  });
});
