import { createInsForgeServerClient } from "@/lib/insforge/server";
import { loadAllPages } from "@/lib/inventory/pagination";

type InsForgeServerClient = Awaited<
  ReturnType<typeof createInsForgeServerClient>
>;

export async function loadActiveOrderSkus(
  insforge: InsForgeServerClient,
): Promise<string[]> {
  const orders = await loadAllPages<{ id: string }>((from, to) =>
    insforge.database
      .from("purchase_orders")
      .select("id")
      .in("status", ["draft", "ordered"])
      .order("id")
      .range(from, to),
  );
  const orderIds = orders.map((order) => String(order.id));
  if (!orderIds.length) return [];

  const items: Array<{ sku: string }> = [];
  for (let index = 0; index < orderIds.length; index += 200) {
    const orderIdBatch = orderIds.slice(index, index + 200);
    const batch = await loadAllPages<{ sku: string }>((from, to) =>
      insforge.database
        .from("purchase_order_items")
        .select("sku")
        .in("order_id", orderIdBatch)
        .order("sku")
        .range(from, to),
    );
    items.push(...batch);
  }

  return [...new Set(items.map((item) => String(item.sku)))];
}
