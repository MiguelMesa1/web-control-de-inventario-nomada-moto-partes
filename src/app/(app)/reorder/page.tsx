import { ReorderWatchlist } from "@/components/reorder-watchlist";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function ReorderPage() {
  const data = await loadInventoryData();
  return (
    <InventoryProvider value={data}>
      <ReorderWatchlist />
    </InventoryProvider>
  );
}
