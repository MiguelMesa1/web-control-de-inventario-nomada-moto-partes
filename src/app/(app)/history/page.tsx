import { HistoryPage } from "@/components/history-page";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function InventoryHistoryPage() {
  const data = await loadInventoryData();
  return (
    <InventoryProvider value={data}>
      <HistoryPage />
    </InventoryProvider>
  );
}
