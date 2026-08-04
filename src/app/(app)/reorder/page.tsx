import { ReorderWatchlist } from "@/components/reorder-watchlist";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadReorderPageData } from "@/lib/inventory/data";

export default async function ReorderPage() {
  const data = await loadReorderPageData();
  return (
    <InventoryProvider value={data}>
      <ReorderWatchlist />
    </InventoryProvider>
  );
}
