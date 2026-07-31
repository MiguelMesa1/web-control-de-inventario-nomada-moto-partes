import { PlasticKitsOverview } from "@/components/plastic-kits-overview";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function PlasticKitsPage() {
  const data = await loadInventoryData();
  return (
    <InventoryProvider value={data}>
      <PlasticKitsOverview />
    </InventoryProvider>
  );
}
