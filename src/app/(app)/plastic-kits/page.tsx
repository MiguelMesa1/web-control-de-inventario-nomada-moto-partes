import { PlasticKitsOverview } from "@/components/plastic-kits-overview";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryPageData } from "@/lib/inventory/data";
import { loadPlasticKitDefinitions } from "@/lib/inventory/plastic-kit-data";

export default async function PlasticKitsPage() {
  const [data, plasticKits] = await Promise.all([
    loadInventoryPageData(),
    loadPlasticKitDefinitions(),
  ]);
  return (
    <InventoryProvider value={data}>
      <PlasticKitsOverview initialKits={plasticKits} />
    </InventoryProvider>
  );
}
