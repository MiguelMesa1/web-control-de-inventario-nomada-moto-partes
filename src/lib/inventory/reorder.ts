import type {
  InventoryItem,
  ReorderAlertRow,
  ReorderLineSetting,
  ReorderWatchItem,
} from "@/types/inventory";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";

export function getReorderPointForLine(
  productLine: string,
  lineSettings: ReorderLineSetting[],
  fallback: number,
) {
  const normalizedLine = normalizeInventoryText(productLine);
  return (
    lineSettings.find(
      (setting) => normalizeInventoryText(setting.productLine) === normalizedLine,
    )?.reorderPoint ?? fallback
  );
}

export function buildReorderAlertRows(
  watchlist: ReorderWatchItem[],
  inventory: InventoryItem[],
): ReorderAlertRow[] {
  const availability = new Map<
    string,
    { available: number; rows: number; productLine: string }
  >();

  for (const item of inventory) {
    const current = availability.get(item.sku) ?? {
      available: 0,
      rows: 0,
      productLine: item.productLine,
    };
    availability.set(item.sku, {
      available: current.available + item.available,
      rows: current.rows + 1,
      productLine: current.productLine,
    });
  }

  return watchlist.map((item) => {
    const inventoryState = availability.get(item.sku);
    const available = inventoryState?.available ?? 0;
    const hasInventoryRecord = Boolean(inventoryState?.rows);
    const status = !hasInventoryRecord
      ? "missing"
      : available <= 0
        ? "exhausted"
        : available <= item.minimumStock
          ? "low"
          : "healthy";

    return {
      ...item,
      productLine: inventoryState?.productLine,
      available,
      suggestedQuantity: Math.max(0, item.maximumStock - available),
      hasInventoryRecord,
      status,
    };
  });
}
