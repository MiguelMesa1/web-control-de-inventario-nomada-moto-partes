import { describe, expect, it } from "vitest";
import { normalizeInventoryRows } from "@/lib/inventory/parser";
import { serializeInventoryImport } from "@/lib/inventory/import-payload";

describe("inventory file normalization", () => {
  it("sends the source date once, without redundant per-row snapshot metadata", () => {
    const items = normalizeInventoryRows([{ SKU: "A", Producto: "Producto", Línea: "Motor", Bodega: "Principal", Existencia: 1 }], "2026-08-01T05:00:00Z");
    const body = JSON.parse(serializeInventoryImport("file.csv", "checksum", "2026-08-01T05:00:00Z", items));
    expect(body.sourceExportedAt).toBe("2026-08-01T05:00:00Z");
    expect(body.items[0]).not.toHaveProperty("sourceExportedAt");
    expect(body.items[0].available).toBe(1);
  });

  it("rejects an oversized serialized import before sending any request", () => {
    const item = normalizeInventoryRows([{ SKU: "A", Producto: "é".repeat(300), Línea: "Motor", Bodega: "Principal", Existencia: 1 }])[0];
    expect(() => serializeInventoryImport("file.csv", "checksum", "2026-08-01T05:00:00Z", Array.from({ length: 7000 }, () => item))).toThrow("4,4 MB");
  });
  it("rejects oversized row sets before normalization", () => {
    expect(() => normalizeInventoryRows(Array.from({ length: 100_001 }, () => ({})))).toThrow("100.000");
  });
  it("maps common Effi aliases and calculates available", () => {
    const [row] = normalizeInventoryRows(
      [
        {
          Referencia: "FR-100",
          Descripción: "Pastilla de freno",
          Familia: "Frenos",
          Almacén: "Principal",
          Existencia: 12,
          Reservado: 2,
        },
      ],
      "2026-07-29T12:00:00.000Z",
    );
    expect(row).toMatchObject({
      sku: "FR-100",
      productName: "Pastilla de freno",
      productLine: "Frenos",
      warehouse: "Principal",
      available: 10,
    });
  });

  it("rejects a duplicate SKU inside the same warehouse", () => {
    const duplicated = {
      SKU: "A-1",
      Producto: "Producto",
      Línea: "Motor",
      Bodega: "Principal",
      Existencia: 3,
    };
    expect(() => normalizeInventoryRows([duplicated, duplicated])).toThrow(
      /está repetida/i,
    );
  });

  it("maps the consolidated Effi export and omits non-inventory rows", () => {
    const rows = normalizeInventoryRows(
      [
        {
          ID: 1,
          Nombre: "FLETE",
          Referencia: "",
          Marca: "",
          "Stock total empresa": "-No aplica-",
        },
        {
          ID: 2,
          Nombre: "CARENAJE",
          Referencia: 2210101,
          Marca: "Akt",
          "Stock total empresa": 7,
        },
        {
          ID: 3,
          Nombre: "CÚPULA",
          Referencia: 2381451,
          Marca: "",
          "Stock total empresa": 1,
        },
      ],
      "2026-07-29T12:00:00.000Z",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sku: "2210101",
      productName: "CARENAJE",
      productLine: "Akt",
      warehouse: "Empresa",
      stock: 7,
      available: 7,
    });
    expect(rows[1].productLine).toBe("Sin marca");
  });

  it("uses Principal warehouse stock for products whose company stock does not apply", () => {
    const rows = normalizeInventoryRows([
      {
        ID: 1088,
        Nombre: "KIT SIN FAROLA BOXER CT 100 NEGRO",
        Referencia: 1088,
        Marca: "Bajaj",
        "Stock total empresa": "-No aplica-",
        "Stock bodega: Principal (Sucursal: Principal)": 31,
      },
      {
        ID: 1,
        Nombre: "FLETE",
        Referencia: "",
        Marca: "",
        "Stock total empresa": "-No aplica-",
        "Stock bodega: Principal (Sucursal: Principal)": "-No aplica-",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sku: "1088",
      warehouse: "Principal",
      stock: 31,
      available: 31,
    });
  });

  it("maps the supplied Effi format and uses ID when Referencia is empty", () => {
    const rows = normalizeInventoryRows([
      {
        ID: 1,
        Nombre: "FLETE",
        Referencia: "",
        Marca: "",
        "Último costo": 0,
        "Gestión de stock": "No",
        "Stock total empresa": "-No aplica-",
        "Stock bodega: Principal (Sucursal: Principal)": "-No aplica-",
      },
      {
        ID: 876,
        Nombre: "COLA DE SILLIN BASE INFERIOR TVS APACHE 200 (N9226840)",
        Referencia: "",
        Marca: "Tvs",
        "Último costo": 0,
        "Gestión de stock": "No",
        "Stock total empresa": 3,
        "Stock bodega: Principal (Sucursal: Principal)": 3,
      },
      {
        ID: 1200,
        Nombre: "CALCOMANIA YAMAHA XTZ 125",
        Referencia: "001-XTZ125",
        Marca: "XTZ 125",
        "Último costo": 5000,
        "Gestión de stock": "No",
        "Stock total empresa": 8,
        "Stock bodega: Principal (Sucursal: Principal)": 8,
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sku: "876",
      productLine: "Tvs",
      warehouse: "Principal",
      stock: 3,
      available: 3,
    });
    expect(rows[1]).toMatchObject({
      sku: "001-XTZ125",
      productLine: "XTZ 125",
      warehouse: "Principal",
      stock: 8,
      available: 8,
    });
  });

  it("rejects missing required columns and invalid quantities", () => {
    expect(() => normalizeInventoryRows([{ SKU: "A-1" }])).toThrow(/faltan/i);
    expect(() =>
      normalizeInventoryRows([
        {
          SKU: "A-1",
          Producto: "Producto",
          Línea: "Motor",
          Bodega: "Principal",
          Existencia: "muchas",
        },
      ]),
    ).toThrow(/número válido/i);
  });

  it("rejects empty files", () => {
    expect(() => normalizeInventoryRows([])).toThrow(/vacío/i);
  });
});
