import { NextResponse } from "next/server";
import { loadReorderAlertData } from "@/lib/inventory/data";
import { getAppProfile } from "@/lib/insforge/session";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";

export async function GET() {
  await getAppProfile();
  const data = await loadReorderAlertData();
  const alerts = buildReorderAlertRows(
    data.reorderWatchlist.filter((item) => item.active),
    data.current,
    data.reorderLineSettings,
  )
    .filter((item) => item.status !== "healthy")
    .sort(
      (a, b) =>
        (a.hasInventoryRecord ? 0 : 1) -
          (b.hasInventoryRecord ? 0 : 1) ||
        a.available - b.available ||
        a.productName.localeCompare(b.productName, "es"),
    )
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      sku: item.sku,
      productName: item.productName,
      productLine: item.productLine,
      available: item.available,
      reorderPoint: item.reorderPoint,
      hasInventoryRecord: item.hasInventoryRecord,
    }));

  return NextResponse.json(
    { alerts },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
