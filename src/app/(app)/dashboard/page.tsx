import { DashboardOverview } from "@/components/dashboard-overview";
import { loadDashboardData } from "@/lib/inventory/data";

export default async function DashboardPage() {
  const data = await loadDashboardData();
  return <DashboardOverview data={data} />;
}
