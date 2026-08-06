import type {
  InventoryItem,
  PlasticKitAvailability,
  PlasticKitDefinition,
} from "@/types/inventory";
import { getPlasticKitModel } from "@/lib/inventory/plastic-kit-taxonomy";

function inventoryKey(warehouse: string, sku: string) {
  return `${warehouse.trim().toLocaleLowerCase("es")}|${sku.trim().toLocaleLowerCase("es")}`;
}

export function comparePlasticKitsForDisplay(
  a: PlasticKitDefinition,
  b: PlasticKitDefinition,
) {
  return (
    headlightOrder(a.hasHeadlight) - headlightOrder(b.hasHeadlight) ||
    getPlasticKitModel(a).localeCompare(getPlasticKitModel(b), "es", {
      numeric: true,
      sensitivity: "base",
    }) ||
    a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" }) ||
    a.color.localeCompare(b.color, "es", { sensitivity: "base" })
  );
}

function headlightOrder(value: boolean | null) {
  if (value === null) return 2;
  return value ? 1 : 0;
}

export function calculatePlasticKitAvailability(
  definitions: PlasticKitDefinition[],
  inventory: InventoryItem[],
): PlasticKitAvailability[] {
  const availableByPart = new Map<string, number>();

  for (const item of inventory) {
    const key = inventoryKey(item.warehouse, item.sku);
    availableByPart.set(key, (availableByPart.get(key) ?? 0) + item.available);
  }

  return definitions.map((definition) => {
    const capacities = definition.parts.map((part) => {
      const key = inventoryKey(definition.warehouse, part.sku);
      const hasInventoryRecord = availableByPart.has(key);
      const available = Math.max(0, availableByPart.get(key) ?? 0);
      return {
        ...part,
        available,
        hasInventoryRecord,
        kitCapacity: Math.floor(available / Math.max(1, part.quantityRequired)),
        isLimiting: false,
      };
    });
    const available = capacities.length
      ? Math.min(...capacities.map((part) => part.kitCapacity))
      : 0;
    const parts = capacities.map((part) => ({
      ...part,
      isLimiting: part.kitCapacity === available,
    }));

    return {
      ...definition,
      available,
      parts,
      limitingPartSkus: parts
        .filter((part) => part.isLimiting)
        .map((part) => part.sku),
    };
  });
}
