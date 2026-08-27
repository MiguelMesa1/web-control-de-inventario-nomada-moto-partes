import { SettingsPanel } from "@/components/settings-panel";
import { loadEmailDeliveryAttempts } from "@/lib/email/delivery-attempts";
import { loadInventoryPageData } from "@/lib/inventory/data";
import { getAppProfile } from "@/lib/insforge/session";

export default async function SettingsPage() {
  const profile = await getAppProfile();
  const isAdmin = profile.role === "admin";
  const [inventory, emailAttempts] = isAdmin
    ? await Promise.all([loadInventoryPageData(), loadEmailDeliveryAttempts()])
    : [{ current: [], lowStockThreshold: 0, isDemo: false }, []];
  return (
    <SettingsPanel
      initialLowStockThreshold={inventory.lowStockThreshold}
      initialEmailAttempts={emailAttempts}
      inventoryAvailability={inventory.current.map((item) => item.available)}
      isDemo={inventory.isDemo}
    />
  );
}
