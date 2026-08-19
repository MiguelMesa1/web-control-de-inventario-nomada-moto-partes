import { demoInventoryData } from "@/lib/demo-data";
import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { loadAllPages } from "@/lib/inventory/pagination";
import type {
  ImportRun,
  DashboardPageData,
  InventoryData,
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
  OrdersPageData,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderStatusCounts,
  PurchaseOrdersPageInfo,
  ReorderPageData,
  ReorderLineSetting,
  ReorderWatchItem,
} from "@/types/inventory";
import { loadActiveOrderSkus } from "@/lib/orders/active-order-data";

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

type DbPurchaseOrder = {
  id: string;
  order_number: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
      "id,source_id,sku,product_name,primary_supplier,secondary_supplier,minimum_stock,maximum_stock,active,notes,created_at,updated_at",
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
      primarySupplier: item.primary_supplier
        ? String(item.primary_supplier)
        : undefined,
      secondarySupplier: item.secondary_supplier
        ? String(item.secondary_supplier)
        : undefined,
      minimumStock: Number(item.minimum_stock),
      maximumStock: Number(item.maximum_stock),
      active: Boolean(item.active),
      notes: item.notes ? String(item.notes) : undefined,
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
    }),
  );
}

type LoadedPurchaseOrders = {
  orders: PurchaseOrder[];
  page: PurchaseOrdersPageInfo;
};

const emptyPurchaseOrderCounts = (): PurchaseOrderStatusCounts => ({
  draft: 0,
  ordered: 0,
  received: 0,
  cancelled: 0,
});

async function loadPurchaseOrderStatusCounts(
  insforge: InsForgeServerClient,
): Promise<PurchaseOrderStatusCounts> {
  const statuses: PurchaseOrderStatus[] = [
    "draft",
    "ordered",
    "received",
    "cancelled",
  ];
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const result = await insforge.database
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (result.error) throw new Error(result.error.message);
      return [status, result.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as PurchaseOrderStatusCounts;
}

async function loadPurchaseOrders(
  insforge: InsForgeServerClient,
  options: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
    includeAllActive?: boolean;
    snapshotBefore?: string;
  } = {},
): Promise<LoadedPurchaseOrders> {
  const {
    limit = 30,
    offset = 0,
    activeOnly = false,
    includeAllActive = false,
    snapshotBefore = new Date().toISOString(),
  } = options;
  const orderFields =
    "id,order_number,supplier_name,status,notes,created_at,updated_at";
  const loadActiveOrders = () =>
    loadAllPages<DbPurchaseOrder>((from, to) =>
      insforge.database
        .from("purchase_orders")
        .select(orderFields)
        .in("status", ["draft", "ordered"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    );
  const queryRecentOrders = () =>
    insforge.database
      .from("purchase_orders")
      .select(orderFields)
      .lte("created_at", snapshotBefore)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);
  const [recentOrdersResult, activeOrders] = activeOnly
    ? [null, await loadActiveOrders()]
    : includeAllActive
      ? await Promise.all([queryRecentOrders(), loadActiveOrders()])
      : [await queryRecentOrders(), []];
  if (recentOrdersResult?.error) throw new Error(recentOrdersResult.error.message);

  const recentOrders = (recentOrdersResult?.data ?? []).slice(0, limit);
  const hasMore = (recentOrdersResult?.data?.length ?? 0) > limit;

  const ordersById = new Map(
    [...recentOrders, ...activeOrders].map(
      (order) => [String(order.id), order],
    ),
  );
  const orders = [...ordersById.values()].sort(
      (a, b) =>
        new Date(String(b.created_at)).getTime() -
        new Date(String(a.created_at)).getTime(),
  );

  const orderIds = orders.map((order) => String(order.id));
  if (!orderIds.length) {
    return {
      orders: [],
      page: { hasMore, nextOffset: offset + limit, snapshotBefore },
    };
  }

  type DbPurchaseOrderItem = {
    id: string;
    order_id: string;
    sku: string;
    product_name: string;
    quantity: number | string;
    available_at_creation: number | string;
    minimum_stock: number | string;
    maximum_stock: number | string;
    created_at: string;
  };
  const purchaseOrderItems: DbPurchaseOrderItem[] = [];
  for (let index = 0; index < orderIds.length; index += 200) {
    const orderIdBatch = orderIds.slice(index, index + 200);
    const batch = await loadAllPages<DbPurchaseOrderItem>((from, to) =>
      insforge.database
        .from("purchase_order_items")
        .select(
          "id,order_id,sku,product_name,quantity,available_at_creation,minimum_stock,maximum_stock,created_at",
        )
        .in("order_id", orderIdBatch)
        .order("product_name")
        .order("id")
        .range(from, to),
    );
    purchaseOrderItems.push(...batch);
  }

  const itemsByOrder = new Map<string, PurchaseOrderItem[]>();
  for (const item of purchaseOrderItems) {
    const orderId = String(item.order_id);
    const mapped: PurchaseOrderItem = {
      id: String(item.id),
      orderId,
      sku: String(item.sku),
      productName: String(item.product_name),
      quantity: Number(item.quantity),
      availableAtCreation: Number(item.available_at_creation),
      minimumStock: Number(item.minimum_stock),
      maximumStock: Number(item.maximum_stock),
      createdAt: String(item.created_at),
    };
    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), mapped]);
  }

  return {
    orders: orders.map(
      (order): PurchaseOrder => ({
        id: String(order.id),
        orderNumber: String(order.order_number),
        supplierName: String(order.supplier_name),
        status: order.status as PurchaseOrder["status"],
        notes: order.notes ? String(order.notes) : undefined,
        createdAt: String(order.created_at),
        updatedAt: String(order.updated_at),
        items: itemsByOrder.get(String(order.id)) ?? [],
      }),
    ),
    page: { hasMore, nextOffset: offset + limit, snapshotBefore },
  };
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

export async function loadDashboardData(): Promise<DashboardPageData> {
  if (!isInsForgeConfigured()) {
    return { ...demoInventoryData, activeOrderSkus: [] };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [
    current,
    snapshots,
    importRuns,
    lowStockThreshold,
    reorderWatchlist,
    activeOrderSkus,
  ] = await Promise.all([
    loadCurrent(insforge),
    loadSnapshots(insforge, 3),
    loadImportRuns(insforge, 4),
    loadLowStockThreshold(insforge),
    loadReorderWatchlist(insforge),
    loadActiveOrderSkus(insforge),
  ]);

  const currentSnapshotId = current[0]?.snapshotId;
  const previousSnapshot = snapshots.find(
    (snapshot) => snapshot.id !== currentSnapshotId,
  );
  const history = previousSnapshot
    ? await loadHistorySnapshot(insforge, previousSnapshot.id)
    : [];

  return {
    ...emptyInventoryData({
      current,
      history,
      snapshots,
      importRuns,
      reorderWatchlist,
      lowStockThreshold,
    }),
    activeOrderSkus,
  };
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

export async function loadReorderPageData(): Promise<ReorderPageData> {
  if (!isInsForgeConfigured()) {
    return { ...demoInventoryData, purchaseOrders: [] };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [current, reorderWatchlist, purchaseOrderResult] = await Promise.all([
    loadCurrent(insforge),
    loadReorderWatchlist(insforge),
    loadPurchaseOrders(insforge, { activeOnly: true }),
  ]);
  return {
    ...emptyInventoryData({ current, reorderWatchlist }),
    purchaseOrders: purchaseOrderResult.orders,
  };
}

export async function loadReorderAlertData() {
  if (!isInsForgeConfigured()) {
    return {
      current: demoInventoryData.current,
      reorderWatchlist: demoInventoryData.reorderWatchlist,
      activeOrderSkus: [],
    };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [current, reorderWatchlist, activeOrderSkus] = await Promise.all([
    loadCurrent(insforge),
    loadReorderWatchlist(insforge),
    loadActiveOrderSkus(insforge),
  ]);
  return { current, reorderWatchlist, activeOrderSkus };
}

export async function loadOrdersPageData(): Promise<OrdersPageData> {
  if (!isInsForgeConfigured()) {
    return {
      current: demoInventoryData.current,
      reorderWatchlist: demoInventoryData.reorderWatchlist,
      purchaseOrders: [],
      purchaseOrdersPage: {
        hasMore: false,
        nextOffset: 0,
        snapshotBefore: new Date().toISOString(),
      },
      purchaseOrderCounts: emptyPurchaseOrderCounts(),
      isDemo: true,
    };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [
    current,
    reorderWatchlist,
    purchaseOrderResult,
    purchaseOrderCounts,
  ] = await Promise.all([
    loadCurrent(insforge),
    loadReorderWatchlist(insforge),
    loadPurchaseOrders(insforge, { includeAllActive: true }),
    loadPurchaseOrderStatusCounts(insforge),
  ]);
  return {
    current,
    reorderWatchlist,
    purchaseOrders: purchaseOrderResult.orders,
    purchaseOrdersPage: purchaseOrderResult.page,
    purchaseOrderCounts,
    isDemo: false,
  };
}

export async function loadPurchaseOrderHistoryPage(
  offset: number,
  limit = 30,
  snapshotBefore = new Date().toISOString(),
) {
  const insforge = await createAuthenticatedInsForgeServerClient();
  return loadPurchaseOrders(insforge, { offset, limit, snapshotBefore });
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
      isDemo: true,
    };
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const lowStockThreshold = await loadLowStockThreshold(insforge);
  return { lowStockThreshold, isDemo: false };
}
