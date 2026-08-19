import { NextResponse } from "next/server";
import {
  demoCurrent,
  demoHistory,
  demoSnapshots,
} from "@/lib/demo-data";
import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { getAppProfile } from "@/lib/insforge/session";
import { buildProductHistory } from "@/lib/inventory/product-history";
import { sanitizeText } from "@/lib/security/input";
import type {
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
} from "@/types/inventory";

type DbHistoryPoint = {
  snapshot_id: string;
  sku: string;
  product_line: string;
  warehouse: string;
  available: number | string;
  recorded_at: string;
};

type DbCurrentValue = {
  available: number | string;
  snapshot_id: string;
  source_exported_at: string;
};

type DbSnapshot = {
  id: string;
  filename: string;
};

export async function GET(request: Request) {
  await getAppProfile();
  const params = new URL(request.url).searchParams;
  const sku = sanitizeText(params.get("sku"), { maxLength: 120 });
  const warehouse = sanitizeText(params.get("warehouse"), { maxLength: 120 });

  if (!sku || !warehouse) {
    return NextResponse.json(
      { message: "Faltan el SKU o el almacén." },
      { status: 400 },
    );
  }

  if (!isInsForgeConfigured()) {
    const current = demoCurrent.find(
      (item) => item.sku === sku && item.warehouse === warehouse,
    );
    const history = demoHistory.filter(
      (point) => point.sku === sku && point.warehouse === warehouse,
    );
    return NextResponse.json({
      data: buildProductHistory(history, current ?? null, demoSnapshots),
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const insforge = await createAuthenticatedInsForgeServerClient();
  const [historyResult, currentResult, snapshotsResult] = await Promise.all([
    insforge.database
      .from("inventory_items")
      .select(
        "snapshot_id,sku,product_line,warehouse,available,recorded_at",
      )
      .eq("sku", sku)
      .eq("warehouse", warehouse)
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(500),
    insforge.database
      .from("inventory_current")
      .select("available,snapshot_id,source_exported_at")
      .eq("sku", sku)
      .eq("warehouse", warehouse)
      .maybeSingle(),
    insforge.database
      .from("inventory_snapshots")
      .select("id,filename")
      .gte("source_exported_at", since.toISOString())
      .order("source_exported_at", { ascending: false })
      .limit(100),
  ]);

  const error =
    historyResult.error ?? currentResult.error ?? snapshotsResult.error;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  const history = ((historyResult.data ?? []) as DbHistoryPoint[]).map(
    (point): InventoryHistoryPoint => ({
      snapshotId: String(point.snapshot_id),
      sku: String(point.sku),
      productLine: String(point.product_line),
      warehouse: String(point.warehouse),
      available: Number(point.available),
      date: String(point.recorded_at),
    }),
  );
  const currentRow = currentResult.data as DbCurrentValue | null;
  const current: Pick<
    InventoryItem,
    "available" | "snapshotId" | "sourceExportedAt"
  > | null = currentRow
    ? {
        available: Number(currentRow.available),
        snapshotId: String(currentRow.snapshot_id),
        sourceExportedAt: String(currentRow.source_exported_at),
      }
    : null;
  const snapshots = ((snapshotsResult.data ?? []) as DbSnapshot[]).map(
    (snapshot): Pick<InventorySnapshot, "id" | "filename"> => ({
      id: String(snapshot.id),
      filename: String(snapshot.filename),
    }),
  );

  return NextResponse.json({
    data: buildProductHistory(history, current, snapshots),
  });
}
