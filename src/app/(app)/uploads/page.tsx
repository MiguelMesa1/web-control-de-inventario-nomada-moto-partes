import { redirect } from "next/navigation";
import { InventoryUpload } from "@/components/inventory-upload";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { getAppProfile } from "@/lib/insforge/session";

export default async function UploadsPage() {
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    redirect("/dashboard");
  }

  return <InventoryUpload isDemo={!isInsForgeConfigured()} />;
}
