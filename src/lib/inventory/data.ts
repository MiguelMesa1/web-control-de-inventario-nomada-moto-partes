import { demoInventoryData } from "@/lib/demo-data";
import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { loadAllPages } from "@/lib/inventory/pagination";
import type {
  ImportRun,
  InventoryData,
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
  ReorderLineSetting,
  ReorderWatchItem,
} from "@/types/inventory";

type InsForgeServerClient = Awaited<
  ReturnType<typeof createAuthenticatedInsForgeServerClient>
>;

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

const mapHistoryPoint = (point: DbHistoryPoint): InventoryHistoryPoint => ({
  date: String(point.recorded_at),
  snapshotId: String(point.snapshot_id),
  productLine: String(point.product_line),
  warehouse: String(point.warehouse),
  sku: String(point.sku),
  available: Number(point.available),
});

function emptyInventoryData(
  values: Partial<InventoryData> = {},
): InventoryData {
  return {
    current: [],
    history: [],
    snapshots: [],
    importRuns: [],
    reorderWatchlist: [],
    reorderLineSettings: [],
    lowStockThreshold: 5,
    loadedAt: new Date().toISOString(),
    isDemo: false,
    ...values,
  };
}

async function loadCurrent(insforge: InsForgeServerClient) {
  const rows = await loadAllPages<DbInventoryItem>((from, to) =>
    insforge.database
      .from("inventory_current")
      .select(
        "sku,product_name,product_line,warehouse,stock,reserved,available,snapshot_id,source_exported_at",
      )
      .order("product_line")
      .order("product_name")
      .order("sku")
      .order("warehouse")
      .range(from, to),
  );
  return rows.map(mapInventoryItem);
}

async function loadHistorySince(
  insforge: InsForgeServerClient,
  since: string,
) {
  const rows = await loadAllPages<DbHistoryPoint>((from, to) =>
    insforge.database
      .from("inventory_items")
      .select(
        "snapshot_id,sku,product_line,warehouse,available,recorded_at",
      )
      .gte("recorded_at", since)
      .order("recorded_at")
      .order("snapshot_id")
      .order("sku")
      .order("warehouse")
      .range(from, to),
  );
  return rows.map(mapHistoryPoint);
}

async function loadHistorySnapshot(
  insforge: InsForgeServerClient,
  snapshotId: string,
) {
  const rows = await loadAllPages<DbHistoryPoint>((from, to) =>
    insforge.database
      .from("inventory_items")
      .select(
        "snapshot_id,sku,product_line,warehouse,available,recorded_at",
      )
      .eq("snapshot_id", snapshotId)
      .order("sku")
      .order("warehouse")
      .range(from, to),
  );
  return rows.map(mapHistoryPoint);
}

async function loadSnapshots(
  insforge: InsForgeServerClient,
  limit = 100,
): Promise<InventorySnapshot[]> {
  const result = await insforge.database
    .from("inventory_snapshots")
    .select(
      "id,filename,checksum,source_exported_at,item_count,uploaded_by,created_at",
    )
    .order("source_exported_at", { ascending: false })
    .limit(limit);
  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map(
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
}

async function loadImportRuns(
  insforge: InsForgeServerClient,
  limit = 100,
): Promise<ImportRun[]> {
  const result = await insforge.database
    .from("import_runs")
    .select(
      "id,filename,status,item_count,source_exported_at,created_at,completed_at,uploaded_by,error_message",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map(
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
}

async function loadLowStockThreshold(insforge: InsForgeServerClient) {
  const result = await insforge.database
    .from("inventory_settings")
    .select("low_stock_threshold")
    .eq("id", true)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return Number(result.data?.low_stock_threshold ?? 5);
}

async function loadReorderWatchlist(
  insforge: InsForgeServerClient,
): Promise<ReorderWatchItem[]> {
  const result = await insforge.database
    .from("reorder_watchlist")
    .select(
      "id,source_id,sku,product_name,supplier,reorder_point,active,notes,created_at,updated_at",
    )
    .order("product_name");
  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map(
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
}

async function loadReorderLineSettings(
  insforge: InsForgeServerClient,
): Promise<ReorderLineSetting[]> {
  const result = await insforge.database
    .from("reorder_line_settings")
    .select("product_line,reorder_point")
    .order("product_line");
  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).map(
    (setting): ReorderLineSetting => ({
      productLine: String(setting.product_line),
      reorderPoint: Number(setting.reorder_point),
    }),
  );
}

export async function loadDashboardData(): Promise<InventoryData> {
  if (!isInsForgeConfigured()) return demoInventoryData;

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [
    current,
    snapshots,
    importRuns,
    lowStockThreshold,
    reorderWatchlist,
    reorderLineSettings,
  ] = await Promise.all([
    loadCurrent(insforge),
    loadSnapshots(insforge, 3),
    loadImportRuns(insforge, 4),
    loadLowStockThreshold(insforge),
    loadReorderWatchlist(insforge),
    loadReorderLineSettings(insforge),
  ]);

  const currentSnapshotId = current[0]?.snapshotId;
  const previousSnapshot = snapshots.find(
    (snapshot) => snapshot.id !== currentSnapshotId,
  );
  const history = previousSnapshot
    ? await loadHistorySnapshot(insforge, previousSnapshot.id)
    : [];

  return emptyInventoryData({
    current,
    history,
    snapshots,
    importRuns,
    reorderWatchlist,
    reorderLineSettings,
    lowStockThreshold,
  });
}

export async function loadInventoryPageData(): Promise<InventoryData> {
  if (!isInsForgeConfigured()) return demoInventoryData;

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [current, lowStockThreshold] = await Promise.all([
    loadCurrent(insforge),
    loadLowStockThreshold(insforge),
  ]);
  return emptyInventoryData({ current, lowStockThreshold });
}

export async function loadHistoryPageData(): Promise<InventoryData> {
  if (!isInsForgeConfigured()) return demoInventoryData;

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [snapshots, importRuns] = await Promise.all([
    loadSnapshots(insforge),
    loadImportRuns(insforge),
  ]);
  return emptyInventoryData({ snapshots, importRuns });
}

export async function loadLinesPageData(): Promise<InventoryData> {
  if (!isInsForgeConfigured()) return demoInventoryData;

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [current, lowStockThreshold, reorderLineSettings] = await Promise.all([
    loadCurrent(insforge),
    loadLowStockThreshold(insforge),
    loadReorderLineSettings(insforge),
  ]);
  return emptyInventoryData({
    current,
    lowStockThreshold,
    reorderLineSettings,
  });
}

export async function loadReorderPageData(): Promise<InventoryData> {
  if (!isInsForgeConfigured()) return demoInventoryData;

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [current, reorderWatchlist, reorderLineSettings] = await Promise.all([
    loadCurrent(insforge),
    loadReorderWatchlist(insforge),
    loadReorderLineSettings(insforge),
  ]);
  return emptyInventoryData({
    current,
    reorderWatchlist,
    reorderLineSettings,
  });
}

export async function loadReorderAlertData() {
  const data = await loadReorderPageData();
  return {
    current: data.current,
    reorderWatchlist: data.reorderWatchlist,
    reorderLineSettings: data.reorderLineSettings,
  };
}

export async function loadInventoryData(): Promise<InventoryData> {
  return loadDashboardData();
}

export async function loadAnalyticsData(): Promise<
  Pick<InventoryData, "current" | "history" | "isDemo">
> {
  if (!isInsForgeConfigured()) {
    return {
      current: demoInventoryData.current,
      history: demoInventoryData.history,
      isDemo: true,
    };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [current, history] = await Promise.all([
    loadCurrent(insforge),
    loadHistorySince(insforge, ninetyDaysAgo.toISOString()),
  ]);
  return { current, history, isDemo: false };
}

export async function loadInventorySettings() {
  if (!isInsForgeConfigured()) {
    return {
      lowStockThreshold: demoInventoryData.lowStockThreshold,
      reorderLineSettings: demoInventoryData.reorderLineSettings,
      isDemo: true,
    };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [lowStockThreshold, reorderLineSettings] = await Promise.all([
    loadLowStockThreshold(insforge),
    loadReorderLineSettings(insforge),
  ]);
  return { lowStockThreshold, reorderLineSettings, isDemo: false };
}
