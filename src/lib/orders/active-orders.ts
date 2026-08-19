import type { PurchaseOrder } from "@/types/inventory";

export type ActiveOrderSummary = {
  status: "draft" | "ordered";
  quantity: number;
  supplierNames: string[];
  orderNumbers: string[];
};

export function buildActiveOrderBySku(
  purchaseOrders: PurchaseOrder[],
): Map<string, ActiveOrderSummary> {
  const states = new Map<string, ActiveOrderSummary>();

  for (const order of purchaseOrders) {
    if (order.status !== "draft" && order.status !== "ordered") continue;

    for (const item of order.items) {
      const current = states.get(item.sku);
      states.set(item.sku, {
        status:
          order.status === "ordered" || current?.status === "ordered"
            ? "ordered"
            : "draft",
        quantity: (current?.quantity ?? 0) + item.quantity,
        supplierNames: [
          ...new Set([...(current?.supplierNames ?? []), order.supplierName]),
        ],
        orderNumbers: [
          ...new Set([...(current?.orderNumbers ?? []), order.orderNumber]),
        ],
      });
    }
  }

  return states;
}

export function excludeActiveOrderRows<T extends { sku: string }>(
  rows: T[],
  activeOrderSkus: Iterable<string>,
): T[] {
  const activeSkus =
    activeOrderSkus instanceof Set
      ? activeOrderSkus
      : new Set(activeOrderSkus);
  return rows.filter((row) => !activeSkus.has(row.sku));
}
