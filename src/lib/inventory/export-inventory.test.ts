import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createInventoryExcel } from "@/lib/inventory/export-inventory";
import type { InventoryItem } from "@/types/inventory";

const item: InventoryItem = {
  sku: "ABC-001",
  productName: "Guardabarros delantero",
  productLine: "Plásticos",
  warehouse: "Principal",
  stock: 15,
  reserved: 3,
  available: 12,
  sourceExportedAt: "2026-09-22T18:30:00.000Z",
};

describe("createInventoryExcel", () => {
  it("crea un archivo xlsx con el inventario", async () => {
    const download = createInventoryExcel([item], "2026-09-23");
    const workbook = XLSX.read(await download.blob.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets.Inventario;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(worksheet);

    expect(download.filename).toBe("inventario-nomada-2026-09-23.xlsx");
    expect(download.blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(rows).toEqual([
      {
        SKU: "ABC-001",
        Producto: "Guardabarros delantero",
        "Línea": "Plásticos",
        Existencia: 15,
        Disponible: 12,
        Fecha: "2026-09-22",
      },
    ]);
    expect(worksheet["!autofilter"]?.ref).toBe("A1:F2");
  });
});
