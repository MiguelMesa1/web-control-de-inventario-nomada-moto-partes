import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { loadAnalyticsData } from "@/lib/inventory/data";

export default async function AnalyticsPage() {
  const data = await loadAnalyticsData();
  return <AnalyticsDashboard current={data.current} history={data.history} />;
}
