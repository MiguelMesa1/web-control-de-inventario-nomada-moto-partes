import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/settings-panel";
import { loadEmailDeliveryAttempts } from "@/lib/email/delivery-attempts";
import { loadInventorySettings } from "@/lib/inventory/data";
import { getAppProfile } from "@/lib/insforge/session";

export default async function SettingsPage() {
  const profile = await getAppProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  const [settings, emailAttempts] = await Promise.all([
    loadInventorySettings(),
    loadEmailDeliveryAttempts(),
  ]);
  return (
    <SettingsPanel
      initialLowStockThreshold={settings.lowStockThreshold}
      initialLineSettings={settings.reorderLineSettings}
      initialEmailAttempts={emailAttempts}
      isDemo={settings.isDemo}
    />
  );
}
