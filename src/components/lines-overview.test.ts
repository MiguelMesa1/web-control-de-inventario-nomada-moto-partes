import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LinesOverview } from "@/components/lines-overview";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import type { InventoryData } from "@/types/inventory";

const inventory: InventoryData = {
  current: [
    {
      sku: "XTZ-001",
      productName: "Guardabarro delantero XTZ 125",
      productLine: "XTZ 125",
      warehouse: "Principal",
      stock: 8,
      reserved: 2,
      available: 6,
      sourceExportedAt: "2026-08-26T12:00:00.000Z",
    },
  ],
  history: [],
  snapshots: [],
  importRuns: [],
  reorderWatchlist: [],
  reorderLineSettings: [],
  lowStockThreshold: 10,
  loadedAt: "2026-08-26T12:00:00.000Z",
  isDemo: false,
};

describe("LinesOverview", () => {
  it("muestra el inventario de la línea seleccionada dentro del mismo panel", () => {
    const providerProps = {
      value: inventory,
    } as Parameters<typeof InventoryProvider>[0];

    const html = renderToStaticMarkup(
      createElement(
        InventoryProvider,
        providerProps,
        createElement(LinesOverview),
      ),
    );

    expect(html).toContain("Inventario de la línea");
    expect(html).toContain("Guardabarro delantero XTZ 125");
    expect(html).toContain("1 de 1");
    expect(html).not.toContain("Abrir inventario completo");
    expect(html).not.toContain("Reservado");
    expect(html).not.toMatch(/>Stock<\/span>/);
  });

  it("pagina las referencias dentro de la vista sin enviarlas a Inventario", () => {
    const paginatedInventory: InventoryData = {
      ...inventory,
      current: Array.from({ length: 25 }, (_, index) => ({
        ...inventory.current[0],
        sku: `XTZ-${String(index + 1).padStart(3, "0")}`,
        productName: `Producto XTZ ${String(index + 1).padStart(2, "0")}`,
      })),
    };
    const providerProps = {
      value: paginatedInventory,
    } as Parameters<typeof InventoryProvider>[0];

    const html = renderToStaticMarkup(
      createElement(
        InventoryProvider,
        providerProps,
        createElement(LinesOverview),
      ),
    );

    expect(html).toContain("1–20 de 25 referencias");
    expect(html).toContain("1 de 2");
    expect(html).toContain("Producto XTZ 20");
    expect(html).not.toContain("Producto XTZ 21");
    expect(html).not.toContain("/inventory?line=");
  });
});
