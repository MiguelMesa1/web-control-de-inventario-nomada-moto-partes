import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function AnalyticsPage() {
  const data = await loadInventoryData();
  return (
    <InventoryProvider value={data}>
      <AnalyticsDashboard />
    </InventoryProvider>
  );
}
