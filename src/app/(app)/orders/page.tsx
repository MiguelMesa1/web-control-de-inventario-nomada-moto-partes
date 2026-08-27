import { OrdersWorkspace } from "@/components/orders-workspace";
import { loadOrdersPageData } from "@/lib/inventory/data";
import { sanitizeText, sanitizeUuid } from "@/lib/security/input";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    order?: string | string[];
    search?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawOrderId = Array.isArray(params.order) ? params.order[0] : params.order;
  const rawQuery = Array.isArray(params.search) ? params.search[0] : params.search;
  const selectedOrderId = sanitizeText(rawOrderId, { maxLength: 64 });
  const initialOrderQuery =
    sanitizeText(rawQuery, { maxLength: 120 }) ?? "";
  const data = await loadOrdersPageData(
    selectedOrderId ? sanitizeUuid(selectedOrderId) ?? undefined : undefined,
  );
  return (
    <OrdersWorkspace
      data={data}
      initialOrderQuery={initialOrderQuery}
      initialSelectedOrderId={selectedOrderId}
    />
  );
}
