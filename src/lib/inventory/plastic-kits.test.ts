import { describe, expect, it } from "vitest";
import {
  calculatePlasticKitAvailability,
  comparePlasticKitsForDisplay,
} from "@/lib/inventory/plastic-kits";
import type { InventoryItem, PlasticKitDefinition } from "@/types/inventory";

const kit: PlasticKitDefinition = {
  id: "kit-1",
  name: "Kit Boxer negro",
  brand: "Bajaj",
  color: "Negro",
  hasHeadlight: false,
  model: "Boxer CT 100",
  warehouse: "Principal",
  active: true,
  parts: [
    { sku: "CAR-1", productName: "Carenaje", quantityRequired: 1, position: 0 },
    { sku: "TAP-1", productName: "Tapas laterales", quantityRequired: 1, position: 1 },
  ],
};

function item(sku: string, available: number, warehouse = "Principal"): InventoryItem {
  return {
    sku,
    productName: sku,
    productLine: "Plásticos",
    warehouse,
    stock: available,
    reserved: 0,
    available,
    sourceExportedAt: "2026-08-03T12:00:00.000Z",
  };
}

describe("calculatePlasticKitAvailability", () => {
  it("uses the individual part with the lowest capacity", () => {
    const [result] = calculatePlasticKitAvailability(
      [kit],
      [item("CAR-1", 20), item("TAP-1", 10)],
    );

    expect(result.available).toBe(10);
    expect(result.limitingPartSkus).toEqual(["TAP-1"]);
  });

  it("takes the quantity required per kit into account", () => {
    const kitWithTwoCovers = {
      ...kit,
      parts: kit.parts.map((part) =>
        part.sku === "TAP-1" ? { ...part, quantityRequired: 2 } : part,
      ),
    };
    const [result] = calculatePlasticKitAvailability(
      [kitWithTwoCovers],
      [item("CAR-1", 20), item("TAP-1", 10)],
    );

    expect(result.available).toBe(5);
  });

  it("returns zero when an individual part is missing", () => {
    const [result] = calculatePlasticKitAvailability([kit], [item("CAR-1", 20)]);

    expect(result.available).toBe(0);
    expect(result.parts.find((part) => part.sku === "TAP-1")?.hasInventoryRecord).toBe(false);
  });

  it("adds duplicate inventory rows for the same part and warehouse", () => {
    const [result] = calculatePlasticKitAvailability(
      [kit],
      [item("CAR-1", 8), item("CAR-1", 7), item("TAP-1", 12)],
    );

    expect(result.available).toBe(12);
  });

  it("does not mix inventory from different warehouses", () => {
    const [result] = calculatePlasticKitAvailability(
      [kit],
      [item("CAR-1", 20), item("TAP-1", 3), item("TAP-1", 50, "Norte")],
    );

    expect(result.available).toBe(3);
  });
});

describe("comparePlasticKitsForDisplay", () => {
  it("agrupa NS 200 antes de NS 200 FI con orden natural", () => {
    const ns200 = {
      ...kit,
      id: "ns-200",
      name: "Kit NS 200 negro",
      brand: "Pulsar NS 125-150-160-200",
      model: "Pulsar NS 125-150-160-200",
    };
    const ns200Fi = {
      ...ns200,
      id: "ns-200-fi",
      name: "Kit NS 200 FI negro",
    };
    const ns160 = {
      ...ns200,
      id: "ns-160",
      name: "Kit NS 160 negro",
    };

    expect(
      [ns200Fi, ns160, ns200].sort(comparePlasticKitsForDisplay).map((item) => item.id),
    ).toEqual(["ns-160", "ns-200", "ns-200-fi"]);
  });

  it("coloca primero los kits sin farola", () => {
    const withHeadlight = { ...kit, id: "with", hasHeadlight: true };
    const withoutHeadlight = { ...kit, id: "without", hasHeadlight: false };

    expect(
      [withHeadlight, withoutHeadlight]
        .sort(comparePlasticKitsForDisplay)
        .map((item) => item.id),
    ).toEqual(["without", "with"]);
  });

  it("ordena alfabéticamente dentro de cada presentación", () => {
    const zebraWithout = { ...kit, id: "zebra-without", name: "Kit Zebra", hasHeadlight: false };
    const alphaWithout = { ...kit, id: "alpha-without", name: "Kit Alfa", hasHeadlight: false };
    const alphaWith = { ...kit, id: "alpha-with", name: "Kit Alfa", hasHeadlight: true };

    expect(
      [alphaWith, zebraWithout, alphaWithout]
        .sort(comparePlasticKitsForDisplay)
        .map((item) => item.id),
    ).toEqual(["alpha-without", "zebra-without", "alpha-with"]);
  });

  it("coloca los kits donde la farola no aplica al final", () => {
    const notApplicable = { ...kit, id: "not-applicable", hasHeadlight: null };
    const withoutHeadlight = { ...kit, id: "without", hasHeadlight: false };

    expect(
      [withoutHeadlight, notApplicable]
        .sort(comparePlasticKitsForDisplay)
        .map((item) => item.id),
    ).toEqual(["without", "not-applicable"]);
  });
});
