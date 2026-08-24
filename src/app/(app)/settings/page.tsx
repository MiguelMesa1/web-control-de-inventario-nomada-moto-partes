import { SettingsPanel } from "@/components/settings-panel";
import { loadEmailDeliveryAttempts } from "@/lib/email/delivery-attempts";
import { loadInventorySettings } from "@/lib/inventory/data";
import { getAppProfile } from "@/lib/insforge/session";

export default async function SettingsPage() {
  const profile = await getAppProfile();
  const isAdmin = profile.role === "admin";
  const [settings, emailAttempts] = isAdmin
    ? await Promise.all([loadInventorySettings(), loadEmailDeliveryAttempts()])
    : [{ lowStockThreshold: 0, isDemo: false }, []];
  return (
    <SettingsPanel
      initialLowStockThreshold={settings.lowStockThreshold}
      initialEmailAttempts={emailAttempts}
      isDemo={settings.isDemo}
    />
  );
}
