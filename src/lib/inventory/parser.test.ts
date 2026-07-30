import { describe, expect, it } from "vitest";
import { normalizeInventoryRows } from "@/lib/inventory/parser";

describe("inventory file normalization", () => {
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
