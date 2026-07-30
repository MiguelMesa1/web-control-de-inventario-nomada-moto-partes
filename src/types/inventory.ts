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
  supplier?: string;
  reorderPoint: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderLineSetting {
  productLine: string;
  reorderPoint: number;
}

export type ReorderStatus = "missing" | "exhausted" | "reorder" | "healthy";

export interface ReorderAlertRow extends ReorderWatchItem {
  productLine?: string;
  available: number;
  deficit: number;
  hasInventoryRecord: boolean;
  status: ReorderStatus;
}

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
