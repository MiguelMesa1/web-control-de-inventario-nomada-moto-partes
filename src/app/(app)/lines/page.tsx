import { LinesOverview } from "@/components/lines-overview";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadLinesPageData } from "@/lib/inventory/data";

export default async function LinesPage() {
  const data = await loadLinesPageData();
  return (
    <InventoryProvider value={data}>
      <LinesOverview />
    </InventoryProvider>
  );
}
