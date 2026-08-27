import { demoCurrent, demoPurchaseOrders } from "@/lib/demo-data";
import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";
import type { InventoryItem, PurchaseOrder } from "@/types/inventory";
import type {
  GlobalSearchOrder,
  GlobalSearchResults,
} from "@/types/search";

type SearchInventoryRow = Pick<
  InventoryItem,
  "sku" | "productName" | "productLine" | "warehouse" | "available"
>;

type DbSearchInventoryRow = {
  sku: string;
  product_name: string;
  product_line: string;
  warehouse: string;
  available: number | string;
};

type DbSearchOrder = {
  id: string;
  order_number: string;
  supplier_name: string;
  status: PurchaseOrder["status"];
};

const RESULT_LIMIT = 6;

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function rankText(value: string, query: string) {
  const normalized = normalizeInventoryText(value);
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  return 2;
}

export function buildGlobalSearchResults(
  rawQuery: string,
  inventoryRows: SearchInventoryRow[],
  orders: Pick<
    PurchaseOrder,
    "id" | "orderNumber" | "supplierName" | "status"
  >[],
): GlobalSearchResults {
  const query = normalizeInventoryText(rawQuery);
  if (query.length < 2) return { products: [], lines: [], orders: [] };

  const matchingRows = inventoryRows.filter((item) =>
    normalizeInventoryText(
      `${item.sku} ${item.productName} ${item.productLine}`,
    ).includes(query),
  );
  const uniqueInventoryRows = new Map<string, SearchInventoryRow>();
  for (const item of matchingRows) {
    uniqueInventoryRows.set(`${item.sku}\u0000${item.warehouse}`, item);
  }

  const productsBySku = new Map<
    string,
    Omit<GlobalSearchResults["products"][number], "href">
  >();
  for (const item of uniqueInventoryRows.values()) {
    const current = productsBySku.get(item.sku);
    productsBySku.set(item.sku, {
      sku: item.sku,
      productName: current?.productName ?? item.productName,
      productLine: current?.productLine ?? item.productLine,
      available: (current?.available ?? 0) + item.available,
    });
  }

  const products = [...productsBySku.values()]
    .sort(
      (a, b) =>
        rankText(a.sku, query) - rankText(b.sku, query) ||
        rankText(a.productName, query) - rankText(b.productName, query) ||
        a.productName.localeCompare(b.productName, "es"),
    )
    .slice(0, RESULT_LIMIT)
    .map((item) => ({
      ...item,
      href: `/inventory?sku=${encodeURIComponent(item.sku)}`,
    }));

  const lines = [...new Set(matchingRows.map((item) => item.productLine))]
    .filter((line) => normalizeInventoryText(line).includes(query))
    .sort(
      (a, b) =>
        rankText(a, query) - rankText(b, query) || a.localeCompare(b, "es"),
    )
    .slice(0, RESULT_LIMIT)
    .map((productLine) => ({
      productLine,
      href: `/inventory?line=${encodeURIComponent(productLine)}`,
    }));

  const matchedOrders: GlobalSearchOrder[] = orders
    .filter((order) =>
      normalizeInventoryText(
        `${order.orderNumber} ${order.supplierName}`,
      ).includes(query),
    )
    .sort(
      (a, b) =>
        rankText(a.orderNumber, query) - rankText(b.orderNumber, query) ||
        a.orderNumber.localeCompare(b.orderNumber, "es"),
    )
    .slice(0, RESULT_LIMIT)
    .map((order) => ({
      ...order,
      href: `/orders?order=${encodeURIComponent(order.id)}&search=${encodeURIComponent(order.orderNumber)}`,
    }));

  return { products, lines, orders: matchedOrders };
}

export async function searchGlobalCatalog(
  query: string,
): Promise<GlobalSearchResults> {
  if (!isInsForgeConfigured()) {
    return buildGlobalSearchResults(query, demoCurrent, demoPurchaseOrders);
  }

  const insforge = await createAuthenticatedInsForgeServerClient();
  const pattern = `%${escapeLikePattern(query)}%`;
  const inventoryFields =
    "sku,product_name,product_line,warehouse,available";
  const orderFields = "id,order_number,supplier_name,status";

  const [skuResult, productResult, lineResult, numberResult, supplierResult] =
    await Promise.all([
      insforge.database
        .from("inventory_current")
        .select(inventoryFields)
        .ilike("sku", pattern)
        .limit(RESULT_LIMIT),
      insforge.database
        .from("inventory_current")
        .select(inventoryFields)
        .ilike("product_name", pattern)
        .limit(RESULT_LIMIT),
      insforge.database
        .from("inventory_current")
        .select(inventoryFields)
        .ilike("product_line", pattern)
        .limit(RESULT_LIMIT),
      insforge.database
        .from("purchase_orders")
        .select(orderFields)
        .ilike("order_number", pattern)
        .order("created_at", { ascending: false })
        .limit(RESULT_LIMIT),
      insforge.database
        .from("purchase_orders")
        .select(orderFields)
        .ilike("supplier_name", pattern)
        .order("created_at", { ascending: false })
        .limit(RESULT_LIMIT),
    ]);

  const results = [
    skuResult,
    productResult,
    lineResult,
    numberResult,
    supplierResult,
  ];
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);

  const inventoryRows = [
    ...(skuResult.data ?? []),
    ...(productResult.data ?? []),
    ...(lineResult.data ?? []),
  ].map(
    (item): SearchInventoryRow => {
      const row = item as DbSearchInventoryRow;
      return {
        sku: String(row.sku),
        productName: String(row.product_name),
        productLine: String(row.product_line),
        warehouse: String(row.warehouse),
        available: Number(row.available),
      };
    },
  );
  const ordersById = new Map<string, PurchaseOrder>();
  for (const item of [
    ...(numberResult.data ?? []),
    ...(supplierResult.data ?? []),
  ]) {
    const row = item as DbSearchOrder;
    ordersById.set(String(row.id), {
      id: String(row.id),
      orderNumber: String(row.order_number),
      supplierName: String(row.supplier_name),
      status: row.status,
      createdBy: "",
      createdByName: "",
      createdAt: "",
      updatedAt: "",
      items: [],
    });
  }

  return buildGlobalSearchResults(query, inventoryRows, [
    ...ordersById.values(),
  ]);
}
