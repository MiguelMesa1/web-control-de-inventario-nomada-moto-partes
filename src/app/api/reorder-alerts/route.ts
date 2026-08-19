import { NextResponse } from "next/server";
import { loadReorderAlertData } from "@/lib/inventory/data";
import { getAppProfile } from "@/lib/insforge/session";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { excludeActiveOrderRows } from "@/lib/orders/active-orders";

export async function GET() {
  await getAppProfile();
  const data = await loadReorderAlertData();
  const allAlerts = excludeActiveOrderRows(
    buildReorderAlertRows(
      data.reorderWatchlist.filter((item) => item.active),
      data.current,
    ),
    data.activeOrderSkus,
  )
    .filter((item) => item.status !== "healthy")
    .sort(
      (a, b) =>
        (a.hasInventoryRecord ? 0 : 1) -
          (b.hasInventoryRecord ? 0 : 1) ||
        a.available - b.available ||
        a.productName.localeCompare(b.productName, "es"),
    )
  const alerts = allAlerts.slice(0, 6).map((item) => ({
      id: item.id,
      sku: item.sku,
      productName: item.productName,
      productLine: item.productLine,
      available: item.available,
      minimumStock: item.minimumStock,
      maximumStock: item.maximumStock,
      primarySupplier: item.primarySupplier,
      hasInventoryRecord: item.hasInventoryRecord,
    }));

  return NextResponse.json(
    { alerts, total: allAlerts.length },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
