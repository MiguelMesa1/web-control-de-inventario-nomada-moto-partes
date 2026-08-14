import { describe, expect, it } from "vitest";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import type { InventoryItem, ReorderWatchItem } from "@/types/inventory";

const watch = (
  sku: string,
  minimumStock = 10,
  maximumStock = 20,
): ReorderWatchItem => ({
  id: sku,
  sku,
  productName: `Producto ${sku}`,
  minimumStock,
  maximumStock,
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

  it("activa la alerta al llegar al mínimo y sugiere completar hasta el máximo", () => {
    const [row] = buildReorderAlertRows(
      [watch("A", 10, 24)],
      [stock("A", 10, "Principal")],
    );
    expect(row.status).toBe("low");
    expect(row.suggestedQuantity).toBe(14);
  });

  it("distingue agotados de referencias ausentes en la carga", () => {
    const rows = buildReorderAlertRows(
      [watch("agotado"), watch("ausente")],
      [stock("agotado", 0, "Principal")],
    );
    expect(rows.map((row) => row.status)).toEqual(["exhausted", "missing"]);
  });

  it("respeta los mínimos y máximos definidos por producto", () => {
    const rows = buildReorderAlertRows(
      [watch("XTZ-1", 8, 16), watch("BOXER-1", 15, 30)],
      [
        stock("XTZ-1", 10, "Principal"),
        stock("BOXER-1", 10, "Principal"),
      ],
    );

    expect(rows).toEqual([
      expect.objectContaining({
        sku: "XTZ-1",
        status: "healthy",
        suggestedQuantity: 6,
      }),
      expect.objectContaining({
        sku: "BOXER-1",
        status: "low",
        suggestedQuantity: 20,
      }),
    ]);
  });
});
