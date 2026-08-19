import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createPurchaseOrderDownload } from "./export-purchase-orders";

const groups = [
  {
    supplierName: "Proveedor Águila / Principal",
    items: [
      {
        sku: "001-ABC",
        productName: "Pastilla de freno delantera",
        quantity: 12,
      },
    ],
  },
  {
    supplierName: "Moto Partes S.A.",
    items: [
      {
        sku: "XYZ-90",
        productName: "Filtro de aceite",
        quantity: 6,
      },
    ],
  },
];

function readRows(bytes: ArrayBuffer) {
  const workbook = XLSX.read(bytes, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string | number>>(worksheet);
}

describe("exportación de pedidos por proveedor", () => {
  it("crea un Excel con Referencia, Nombre y Cantidad a solicitar", async () => {
    const download = await createPurchaseOrderDownload(
      [groups[0]],
      "2026-08-18",
    );

    expect(download.filename).toBe(
      "pedido-proveedor-aguila-principal-2026-08-18.xlsx",
    );
    expect(download.fileCount).toBe(1);
    const rows = readRows(await download.blob.arrayBuffer());
    expect(rows).toEqual([
      {
        Referencia: "001-ABC",
        Nombre: "Pastilla de freno delantera",
        "Cantidad a solicitar": 12,
      },
    ]);
  });

  it("empaqueta un Excel independiente por proveedor cuando hay varios", async () => {
    const download = await createPurchaseOrderDownload(groups, "2026-08-18");

    expect(download.filename).toBe("pedidos-por-proveedor-2026-08-18.zip");
    expect(download.fileCount).toBe(2);
    const zip = await JSZip.loadAsync(await download.blob.arrayBuffer());
    const filenames = Object.keys(zip.files).sort();
    expect(filenames).toEqual([
      "pedido-moto-partes-s.a-2026-08-18.xlsx",
      "pedido-proveedor-aguila-principal-2026-08-18.xlsx",
    ]);

    const supplierFile = zip.file(
      "pedido-moto-partes-s.a-2026-08-18.xlsx",
    );
    expect(supplierFile).not.toBeNull();
    const rows = readRows(await supplierFile!.async("arraybuffer"));
    expect(rows[0]).toEqual({
      Referencia: "XYZ-90",
      Nombre: "Filtro de aceite",
      "Cantidad a solicitar": 6,
    });
  });
});
