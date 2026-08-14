import { OrdersWorkspace } from "@/components/orders-workspace";
import { loadOrdersPageData } from "@/lib/inventory/data";

export default async function OrdersPage() {
  const data = await loadOrdersPageData();
  return <OrdersWorkspace data={data} />;
}
