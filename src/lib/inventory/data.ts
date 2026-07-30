import { demoInventoryData } from "@/lib/demo-data";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type {
  ImportRun,
  InventoryData,
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
  ReorderWatchItem,
  ReorderLineSetting,
} from "@/types/inventory";

type DbInventoryItem = {
  sku: string;
  product_name: string;
  product_line: string;
  warehouse: string;
  stock: number | string;
  reserved: number | string;
  available: number | string;
  snapshot_id: string;
  source_exported_at: string;
};

type DbHistoryPoint = {
  snapshot_id: string;
  sku: string;
  product_line: string;
  warehouse: string;
  available: number | string;
  recorded_at: string;
};

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

const DATABASE_PAGE_SIZE = 1_000;

async function loadAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
) {
  const first = await loadPage(0, DATABASE_PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);

  const firstRows = first.data ?? [];
  const total = first.count ?? firstRows.length;
  if (total <= firstRows.length) return firstRows;

  const remainingPageStarts = Array.from(
    {
      length: Math.ceil((total - firstRows.length) / DATABASE_PAGE_SIZE),
    },
    (_, index) => (index + 1) * DATABASE_PAGE_SIZE,
  );
  const remaining = await Promise.all(
    remainingPageStarts.map((from) =>
      loadPage(from, from + DATABASE_PAGE_SIZE - 1),
    ),
  );
  const pageError = remaining.find((page) => page.error)?.error;
  if (pageError) throw new Error(pageError.message);

  return [
    ...firstRows,
    ...remaining.flatMap((page) => page.data ?? []),
  ];
}

const mapInventoryItem = (item: DbInventoryItem): InventoryItem => ({
  sku: item.sku,
  productName: item.product_name,
  productLine: item.product_line,
  warehouse: item.warehouse,
  stock: Number(item.stock),
  reserved: Number(item.reserved),
  available: Number(item.available),
  snapshotId: item.snapshot_id,
  sourceExportedAt: item.source_exported_at,
});

export async function loadInventoryData(): Promise<InventoryData> {
  if (!isInsForgeConfigured()) return demoInventoryData;

  const insforge = await createInsForgeServerClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [
    currentResult,
    historyResult,
    snapshotsResult,
    runsResult,
    settingsResult,
    reorderResult,
    lineSettingsResult,
  ] =
    await Promise.all([
      loadAllPages<DbInventoryItem>((from, to) =>
        insforge.database
          .from("inventory_current")
          .select(
            "sku,product_name,product_line,warehouse,stock,reserved,available,snapshot_id,source_exported_at",
            { count: "exact" },
          )
          .order("product_line")
          .order("product_name")
          .order("sku")
          .order("warehouse")
          .range(from, to),
      ),
      loadAllPages<DbHistoryPoint>((from, to) =>
        insforge.database
          .from("inventory_items")
          .select(
            "snapshot_id,sku,product_line,warehouse,available,recorded_at",
            { count: "exact" },
          )
          .gte("recorded_at", ninetyDaysAgo.toISOString())
          .order("recorded_at")
          .order("snapshot_id")
          .order("sku")
          .order("warehouse")
          .range(from, to),
      ),
      insforge.database
        .from("inventory_snapshots")
        .select(
          "id,filename,checksum,source_exported_at,item_count,uploaded_by,created_at",
        )
        .order("source_exported_at", { ascending: false })
        .limit(100),
      insforge.database
        .from("import_runs")
        .select(
          "id,filename,status,item_count,source_exported_at,created_at,completed_at,uploaded_by,error_message",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      insforge.database
        .from("inventory_settings")
        .select("low_stock_threshold")
        .eq("id", true)
        .maybeSingle(),
      insforge.database
        .from("reorder_watchlist")
        .select(
          "id,source_id,sku,product_name,supplier,reorder_point,active,notes,created_at,updated_at",
        )
        .order("product_name"),
      insforge.database
        .from("reorder_line_settings")
        .select("product_line,reorder_point")
        .order("product_line"),
    ]);

  const firstError = [
    snapshotsResult.error,
    runsResult.error,
    settingsResult.error,
    reorderResult.error,
    lineSettingsResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new Error(firstError.message);
  }

  const current = currentResult.map(mapInventoryItem);
  const history = historyResult.map(
    (point): InventoryHistoryPoint => ({
      date: String(point.recorded_at),
      snapshotId: String(point.snapshot_id),
      productLine: String(point.product_line),
      warehouse: String(point.warehouse),
      sku: String(point.sku),
      available: Number(point.available),
    }),
  );
  const snapshots = (snapshotsResult.data ?? []).map(
    (snapshot): InventorySnapshot => ({
      id: String(snapshot.id),
      filename: String(snapshot.filename),
      checksum: String(snapshot.checksum),
      sourceExportedAt: String(snapshot.source_exported_at),
      itemCount: Number(snapshot.item_count),
      uploadedBy: String(snapshot.uploaded_by),
      createdAt: String(snapshot.created_at),
    }),
  );
  const importRuns = (runsResult.data ?? []).map(
    (run): ImportRun => ({
      id: String(run.id),
      filename: String(run.filename),
      status: run.status as ImportRun["status"],
      itemCount: Number(run.item_count),
      sourceExportedAt: run.source_exported_at
        ? String(run.source_exported_at)
        : undefined,
      createdAt: String(run.created_at),
      completedAt: run.completed_at ? String(run.completed_at) : undefined,
      uploadedBy: String(run.uploaded_by),
      errorMessage: run.error_message ? String(run.error_message) : undefined,
    }),
  );
  const reorderWatchlist = (reorderResult.data ?? []).map(
    (item): ReorderWatchItem => ({
      id: String(item.id),
      sourceId:
        item.source_id === null || item.source_id === undefined
          ? undefined
          : Number(item.source_id),
      sku: String(item.sku),
      productName: String(item.product_name),
      supplier: item.supplier ? String(item.supplier) : undefined,
      reorderPoint: Number(item.reorder_point),
      active: Boolean(item.active),
      notes: item.notes ? String(item.notes) : undefined,
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
    }),
  );
  const reorderLineSettings = (lineSettingsResult.data ?? []).map(
    (setting): ReorderLineSetting => ({
      productLine: String(setting.product_line),
      reorderPoint: Number(setting.reorder_point),
    }),
  );

  return {
    current,
    history,
    snapshots,
    importRuns,
    reorderWatchlist,
    reorderLineSettings,
    lowStockThreshold: Number(settingsResult.data?.low_stock_threshold ?? 5),
    loadedAt: new Date().toISOString(),
    isDemo: false,
  };
}
