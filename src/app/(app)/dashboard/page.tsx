import { DashboardOverview } from "@/components/dashboard-overview";
import { loadInventoryData } from "@/lib/inventory/data";

export default async function DashboardPage() {
  const data = await loadInventoryData();
  return <DashboardOverview data={data} />;
}
