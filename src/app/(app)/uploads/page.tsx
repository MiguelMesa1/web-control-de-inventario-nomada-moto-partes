import { InventoryUpload } from "@/components/inventory-upload";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function UploadsPage() {
  const data = await loadInventoryData();

  return (
    <InventoryProvider value={data}>
      <InventoryUpload />
    </InventoryProvider>
  );
}
