import { HistoryPage } from "@/components/history-page";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadHistoryPageData } from "@/lib/inventory/data";

export default async function InventoryHistoryPage() {
  const data = await loadHistoryPageData();
  return (
    <InventoryProvider value={data}>
      <HistoryPage />
    </InventoryProvider>
  );
}
