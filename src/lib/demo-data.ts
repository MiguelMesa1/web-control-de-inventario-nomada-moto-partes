import type {
  ImportRun,
  InventoryData,
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
  PlasticKitDefinition,
  ReorderWatchItem,
  UserProfile,
} from "@/types/inventory";

const baseProducts = [
  ["NM-001", "Pastillas de freno ceramic", "Frenos", "Principal", 48, 6],
  ["NM-002", "Disco delantero 220 mm", "Frenos", "Principal", 12, 2],
  ["NM-003", "Kit de arrastre reforzado", "Transmisión", "Principal", 34, 4],
  ["NM-004", "Cadena 428H x 132", "Transmisión", "Norte", 27, 3],
  ["NM-005", "Batería AGM 12V 7Ah", "Eléctrico", "Principal", 18, 1],
  ["NM-006", "Bombillo LED H4", "Eléctrico", "Norte", 62, 8],
  ["NM-007", "Filtro de aire alto flujo", "Motor", "Principal", 9, 2],
  ["NM-008", "Kit cilindro 150 cc", "Motor", "Principal", 0, 0],
  ["NM-009", "Amortiguador trasero sport", "Suspensión", "Principal", 6, 2],
  ["NM-010", "Retenedor telescópico", "Suspensión", "Norte", 3, 0],
  ["NM-011", "Espejo deportivo carbono", "Accesorios", "Principal", 42, 4],
  ["NM-012", "Slider protector universal", "Accesorios", "Norte", 0, 0],
  ["2220201", "Carenaje sin farola Bajaj Boxer CT 100 negro", "Bajaj", "Principal", 20, 0],
  ["2420201", "Cola de sillín Bajaj Boxer CT 100 negro", "Bajaj", "Principal", 16, 0],
  ["2521631", "Guardabarro delantero Boxer CT 100 negro", "Bajaj", "Principal", 13, 0],
  ["2720201", "Tapas laterales Bajaj Boxer CT 100 negro", "Bajaj", "Principal", 10, 0],
  ["4620201", "Farola Bajaj Boxer CT 100", "Bajaj", "Principal", 7, 0],
  ["2292401", "Carenaje sin farola Yamaha XTZ 125 negro", "Yamaha", "Principal", 18, 0],
  ["2592411", "Guardabarro delantero Yamaha XTZ 125 negro", "Yamaha", "Principal", 12, 0],
  ["2692401", "Guardabarro trasero Yamaha XTZ 125 negro", "Yamaha", "Principal", 14, 0],
  ["2792401", "Tapas laterales Yamaha XTZ 125 negro", "Yamaha", "Principal", 9, 0],
  ["2792411", "Tapas tanque Yamaha XTZ 125 negro", "Yamaha", "Principal", 11, 0],
] as const;

const today = new Date();
today.setMinutes(0, 0, 0);

export const demoCurrent: InventoryItem[] = baseProducts.map(
  ([sku, productName, productLine, warehouse, stock, reserved]) => ({
    sku,
    productName,
    productLine,
    warehouse,
    stock,
    reserved,
    available: stock - reserved,
    snapshotId: "snapshot-current",
    sourceExportedAt: today.toISOString(),
  }),
);

export const demoHistory: InventoryHistoryPoint[] = Array.from(
  { length: 13 },
  (_, weekIndex) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (12 - weekIndex) * 7);
    const growth = weekIndex - 12;

    return baseProducts.map(
      ([sku, , productLine, warehouse, stock], productIndex) => ({
        date: date.toISOString(),
        snapshotId: `snapshot-${weekIndex}`,
        productLine,
        warehouse,
        sku,
        available: Math.max(
          0,
          stock + growth * ((productIndex % 4) + 1) + ((weekIndex + productIndex) % 5),
        ),
      }),
    );
  },
).flat();

export const demoSnapshots: InventorySnapshot[] = Array.from(
  { length: 8 },
  (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index * 7);
    return {
      id: index === 0 ? "snapshot-current" : `snapshot-${12 - index}`,
      filename: `inventario_effi_${date.toISOString().slice(0, 10)}.xlsx`,
      checksum: `demo-${index}`,
      sourceExportedAt: date.toISOString(),
      itemCount: baseProducts.length,
      uploadedBy: "Administrador principal",
      createdAt: date.toISOString(),
    };
  },
);

export const demoImportRuns: ImportRun[] = demoSnapshots.map(
  (snapshot, index) => ({
    id: `run-${index}`,
    filename: snapshot.filename,
    status: index === 5 ? "failed" : "completed",
    itemCount: index === 5 ? 0 : snapshot.itemCount,
    sourceExportedAt: snapshot.sourceExportedAt,
    createdAt: snapshot.createdAt,
    completedAt: snapshot.createdAt,
    uploadedBy: index % 2 ? "Laura Gómez" : "Administrador principal",
    errorMessage:
      index === 5 ? "El archivo no contenía la columna “Bodega”." : undefined,
  }),
);

export const demoProfile: UserProfile = {
  id: "demo-admin",
  email: "admin@nomadamotopartes.co",
  displayName: "Administrador principal",
  role: "admin",
  active: true,
  isPrimary: true,
  lastLoginAt: today.toISOString(),
};

export const demoPlasticKits: PlasticKitDefinition[] = [
  {
    id: "demo-kit-boxer-negro",
    name: "Kit Boxer CT 100 negro",
    brand: "Bajaj",
    color: "Negro",
    hasHeadlight: false,
    model: "Boxer CT 100",
    warehouse: "Principal",
    active: true,
    parts: [
      { sku: "2220201", productName: "Carenaje sin farola Bajaj Boxer CT 100 negro", quantityRequired: 1, position: 0 },
      { sku: "2420201", productName: "Cola de sillín Bajaj Boxer CT 100 negro", quantityRequired: 1, position: 1 },
      { sku: "2521631", productName: "Guardabarro delantero Boxer CT 100 negro", quantityRequired: 1, position: 2 },
      { sku: "2720201", productName: "Tapas laterales Bajaj Boxer CT 100 negro", quantityRequired: 1, position: 3 },
    ],
  },
  {
    id: "demo-kit-xtz-negro",
    name: "Kit Yamaha XTZ 125 negro",
    brand: "Yamaha",
    color: "Negro",
    hasHeadlight: false,
    model: "XTZ 125",
    warehouse: "Principal",
    active: true,
    parts: [
      { sku: "2292401", productName: "Carenaje sin farola Yamaha XTZ 125 negro", quantityRequired: 1, position: 0 },
      { sku: "2592411", productName: "Guardabarro delantero Yamaha XTZ 125 negro", quantityRequired: 1, position: 1 },
      { sku: "2692401", productName: "Guardabarro trasero Yamaha XTZ 125 negro", quantityRequired: 1, position: 2 },
      { sku: "2792401", productName: "Tapas laterales Yamaha XTZ 125 negro", quantityRequired: 1, position: 3 },
      { sku: "2792411", productName: "Tapas tanque Yamaha XTZ 125 negro", quantityRequired: 1, position: 4 },
    ],
  },
];

export const demoReorderWatchlist: ReorderWatchItem[] = demoCurrent
  .slice(6, 11)
  .map((item, index) => ({
    id: `demo-watch-${index}`,
    sku: item.sku,
    productName: item.productName,
    primarySupplier: index % 2 ? "Proveedor Norte" : "Proveedor principal",
    secondarySupplier: index % 2 ? "Proveedor alterno" : undefined,
    minimumStock: 10,
    maximumStock: 24,
    active: true,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  }));

export const demoInventoryData: InventoryData = {
  current: demoCurrent,
  history: demoHistory,
  snapshots: demoSnapshots,
  importRuns: demoImportRuns,
  reorderWatchlist: demoReorderWatchlist,
  reorderLineSettings: [
    { productLine: "Motor", reorderPoint: 12 },
    { productLine: "Suspensi\u00f3n", reorderPoint: 6 },
  ],
  lowStockThreshold: 5,
  loadedAt: today.toISOString(),
  isDemo: true,
};
