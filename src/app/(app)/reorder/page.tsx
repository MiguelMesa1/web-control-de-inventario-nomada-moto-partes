import { ReorderWatchlist } from "@/components/reorder-watchlist";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadReorderPageData } from "@/lib/inventory/data";

export default async function ReorderPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string | string[] }>;
}) {
  const params = await searchParams;
  const sku = Array.isArray(params.sku) ? params.sku[0] : params.sku;
  const initialQuery = sku?.slice(0, 120) ?? "";
  const data = await loadReorderPageData();
  return (
    <InventoryProvider value={data}>
      <ReorderWatchlist
        purchaseOrders={data.purchaseOrders}
        initialQuery={initialQuery}
      />
    </InventoryProvider>
  );
}
