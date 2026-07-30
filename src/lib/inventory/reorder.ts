import type {
  InventoryItem,
  ReorderAlertRow,
  ReorderLineSetting,
  ReorderWatchItem,
} from "@/types/inventory";

export function buildReorderAlertRows(
  watchlist: ReorderWatchItem[],
  inventory: InventoryItem[],
  lineSettings: ReorderLineSetting[] = [],
): ReorderAlertRow[] {
  const linePoints = new Map(
    lineSettings.map((setting) => [setting.productLine.trim().toLocaleLowerCase("es"), setting.reorderPoint]),
  );
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
    const reorderPoint = inventoryState
      ? (linePoints.get(inventoryState.productLine.trim().toLocaleLowerCase("es")) ?? item.reorderPoint)
      : item.reorderPoint;
    const status = !hasInventoryRecord
      ? "missing"
      : available <= 0
        ? "exhausted"
        : available <= reorderPoint
          ? "reorder"
          : "healthy";

    return {
      ...item,
      reorderPoint,
      productLine: inventoryState?.productLine,
      available,
      deficit: Math.max(0, reorderPoint - available),
      hasInventoryRecord,
      status,
    };
  });
}
