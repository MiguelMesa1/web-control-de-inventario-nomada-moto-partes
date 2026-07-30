import type {
  InventoryHistoryPoint,
  InventoryItem,
} from "@/types/inventory";

export function historySnapshotToInventory(
  history: InventoryHistoryPoint[],
  current: InventoryItem[],
  snapshotId?: string,
) {
  const dates = [...new Set(history.map((point) => point.date))].sort();
  const selectedDate =
    snapshotId ??
    (dates.length > 1 ? dates[dates.length - 2] : dates[dates.length - 1]);
  const currentLookup = new Map(
    current.map((item) => [`${item.sku}::${item.warehouse}`, item]),
  );

  return history
    .filter((point) => point.date === selectedDate)
    .map((point): InventoryItem => {
      const item = currentLookup.get(`${point.sku}::${point.warehouse}`);
      return {
        sku: point.sku,
        productName: item?.productName ?? point.sku,
        productLine: point.productLine,
        warehouse: point.warehouse,
        stock: point.available,
        reserved: 0,
        available: point.available,
        snapshotId: point.snapshotId,
        sourceExportedAt: point.date,
      };
    });
}
