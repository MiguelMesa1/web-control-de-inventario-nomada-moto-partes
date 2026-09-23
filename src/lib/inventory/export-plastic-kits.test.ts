import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createPlasticKitsExcel } from "@/lib/inventory/export-plastic-kits";
import type { PlasticKitAvailability } from "@/types/inventory";

const kit: PlasticKitAvailability = {
  id: "kit-1",
  name: "Kit XTZ 150 azul",
  brand: "Yamaha",
  model: "XTZ 150",
  color: "Azul",
  hasHeadlight: true,
  warehouse: "Principal",
  active: true,
  available: 12,
  limitingPartSkus: [],
  parts: [
    {
      sku: "P-001",
      productName: "Guardabarros",
      quantityRequired: 1,
      position: 1,
      available: 20,
      kitCapacity: 20,
      hasInventoryRecord: true,
      isLimiting: false,
    },
  ],
};

describe("createPlasticKitsExcel", () => {
  it("crea un archivo xlsx con la disponibilidad de los kits", async () => {
    const download = createPlasticKitsExcel([kit], "2026-09-23");
    const workbook = XLSX.read(await download.blob.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets["Kits plásticos"];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(worksheet);

    expect(download.filename).toBe("kits-plastico-nomada-2026-09-23.xlsx");
    expect(download.blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(rows).toEqual([
      {
        Kit: "Kit XTZ 150 azul",
        Modelo: "XTZ 150",
        Color: "Azul",
        Farola: "Con farola",
        Piezas: 1,
        "Kits armables": 12,
      },
    ]);
    expect(worksheet["!autofilter"]?.ref).toBe("A1:F2");
  });
});
