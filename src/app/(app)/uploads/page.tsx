import { InventoryUpload } from "@/components/inventory-upload";
import { isInsForgeConfigured } from "@/lib/insforge/config";

export default function UploadsPage() {
  return <InventoryUpload isDemo={!isInsForgeConfigured()} />;
}
