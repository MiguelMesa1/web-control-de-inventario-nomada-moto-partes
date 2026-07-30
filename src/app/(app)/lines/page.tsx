import { LinesOverview } from "@/components/lines-overview";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function LinesPage() {
  const data = await loadInventoryData();
  return (
    <InventoryProvider value={data}>
      <LinesOverview />
    </InventoryProvider>
  );
}
