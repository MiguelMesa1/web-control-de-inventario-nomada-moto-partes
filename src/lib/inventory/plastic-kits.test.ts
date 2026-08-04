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
  it("coloca primero los kits sin farola", () => {
    const withHeadlight = { ...kit, id: "with", hasHeadlight: true };
    const withoutHeadlight = { ...kit, id: "without", hasHeadlight: false };

    expect(
      [withHeadlight, withoutHeadlight]
        .sort(comparePlasticKitsForDisplay)
        .map((item) => item.id),
    ).toEqual(["without", "with"]);
  });
});
