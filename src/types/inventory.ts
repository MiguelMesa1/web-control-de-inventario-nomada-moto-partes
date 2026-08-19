export type UserRole = "admin" | "reader" | "uploader" | "blocked";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  isPrimary: boolean;
  lastLoginAt?: string;
}

export interface InventoryItem {
  sku: string;
  productName: string;
  productLine: string;
  warehouse: string;
  stock: number;
  reserved: number;
  available: number;
  snapshotId?: string;
  sourceExportedAt: string;
}

export interface InventorySnapshot {
  id: string;
  filename: string;
  checksum: string;
  sourceExportedAt: string;
  itemCount: number;
  uploadedBy: string;
  createdAt: string;
}

export interface InventoryHistoryPoint {
  date: string;
  snapshotId: string;
  productLine: string;
  warehouse: string;
  sku: string;
  available: number;
}

export interface LineMetric {
  line: string;
  available: number;
  references: number;
  exhausted: number;
  lowStock: number;
  change: number;
  changePercent: number;
}

export interface ProductMovement {
  sku: string;
  productName: string;
  productLine: string;
  warehouse: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface ProductHistorySubject {
  sku: string;
  productName: string;
  productLine: string;
  warehouse: string;
  available: number;
}

export interface ProductHistoryEvent {
  snapshotId: string;
  filename: string;
  date: string;
  previousAvailable: number | null;
  available: number;
  change: number | null;
  kind: "initial" | "increase" | "decrease";
}

export interface ProductHistoryPayload {
  events: ProductHistoryEvent[];
  changes: number;
  netChange: number;
}

export interface ImportRun {
  id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
  itemCount: number;
  sourceExportedAt?: string;
  createdAt: string;
  completedAt?: string;
  uploadedBy: string;
  errorMessage?: string;
}

export interface EmailDeliveryAttempt {
  id: string;
  snapshotId?: string;
  filename: string;
  senderEmail: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  status: "sent" | "failed";
  alertCount: number;
  suggestedUnits: number;
  durationMs?: number;
  providerMessageId?: string;
  providerResponse?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ProductAttachment {
  id: string;
  sku: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface ReorderWatchItem {
  id: string;
  sourceId?: number;
  sku: string;
  productName: string;
  primarySupplier?: string;
  secondarySupplier?: string;
  minimumStock: number;
  maximumStock: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderLineSetting {
  productLine: string;
  reorderPoint: number;
}

export interface PlasticKitPartDefinition {
  id?: string;
  sku: string;
  productName: string;
  quantityRequired: number;
  position: number;
}

export interface PlasticKitDefinition {
  id: string;
  name: string;
  brand: string;
  color: string;
  hasHeadlight: boolean | null;
  model?: string;
  warehouse: string;
  active: boolean;
  parts: PlasticKitPartDefinition[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PlasticKitPartAvailability extends PlasticKitPartDefinition {
  available: number;
  kitCapacity: number;
  hasInventoryRecord: boolean;
  isLimiting: boolean;
}

export interface PlasticKitAvailability extends PlasticKitDefinition {
  available: number;
  parts: PlasticKitPartAvailability[];
  limitingPartSkus: string[];
}

export type ReorderStatus = "missing" | "exhausted" | "low" | "healthy";

export interface ReorderAlertRow extends ReorderWatchItem {
  productLine?: string;
  available: number;
  suggestedQuantity: number;
  hasInventoryRecord: boolean;
  status: ReorderStatus;
}

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "received"
  | "cancelled";

export interface PurchaseOrderItem {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  availableAtCreation: number;
  minimumStock: number;
  maximumStock: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

export interface OrdersPageData {
  current: InventoryItem[];
  reorderWatchlist: ReorderWatchItem[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrdersPage: PurchaseOrdersPageInfo;
  purchaseOrderCounts: PurchaseOrderStatusCounts;
  isDemo: boolean;
}

export interface PurchaseOrdersPageInfo {
  hasMore: boolean;
  nextOffset: number;
  snapshotBefore: string;
}

export type PurchaseOrderStatusCounts = Record<PurchaseOrderStatus, number>;

export interface InventoryData {
  current: InventoryItem[];
  history: InventoryHistoryPoint[];
  snapshots: InventorySnapshot[];
  importRuns: ImportRun[];
  reorderWatchlist: ReorderWatchItem[];
  reorderLineSettings: ReorderLineSetting[];
  lowStockThreshold: number;
  loadedAt: string;
  isDemo: boolean;
}

export interface DashboardPageData extends InventoryData {
  activeOrderSkus: string[];
}

export interface ReorderPageData extends InventoryData {
  purchaseOrders: PurchaseOrder[];
}
