import type {
  ImportRun,
  InventoryData,
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
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
  ["1088", "KIT SIN FAROLA BOXER CT 100 NEGRO", "Bajaj", "Principal", 31, 0],
  ["1091", "KIT SIN FAROLA BOXER CT 100 AZUL", "Bajaj", "Principal", 32, 0],
  ["1093", "KIT CON FAROLA BOXER CT 100 NEGRO", "Bajaj", "Principal", 14, 0],
  ["1094", "KIT CON FAROLA BOXER CT 100 ROJO", "Bajaj", "Principal", 14, 0],
  ["1095", "KIT CON FAROLA BOXER CT 100 BLANCO", "Bajaj", "Principal", 14, 0],
  ["1096", "KIT CON FAROLA BOXER CT 100 AZUL", "Bajaj", "Principal", 14, 0],
  ["1097", "KIT CON FAROLA BOXER CT 100 GRIS", "Bajaj", "Principal", 14, 0],
  ["1108", "KIT SIN FAROLA BAJAJ PULSAR 200 - 220 NEGRO", "Bajaj", "Principal", 13, 0],
  ["1109", "KIT CON FAROLA BAJAJ PULSAR 200 - 220 NEGRO", "Bajaj", "Principal", 7, 0],
  ["1110", "KIT SIN FAROLA BAJAJ PULSAR 200-220 BLANCO", "Bajaj", "Principal", 32, 0],
  ["1111", "KIT CON FAROLA BAJAJ PULSAR 200-220 BLANCO", "Bajaj", "Principal", 0, 0],
  ["1112", "KIT SIN FAROLA BAJAJ PULSAR 200 - 220 ROJO", "Bajaj", "Principal", 25, 0],
  ["1113", "KIT CON FAROLA BAJAJ PULSAR 200 - 220 ROJO", "Bajaj", "Principal", 0, 0],
  ["1114", "KIT SIN FAROLA BAJAJ PULSAR 200 - 220 AZUL", "Bajaj", "Principal", 15, 0],
  ["1115", "KIT CON FAROLA BAJAJ PULSAR 200 - 220 AZUL", "Bajaj", "Principal", 7, 0],
  ["1116", "KIT CON FAROLA BAJAJ PULSAR 200 - 220 VERDE", "Bajaj", "Principal", 0, 0],
  ["1117", "KIT SIN FAROLA BAJAJ PULSAR 200 - 220 VERDE", "Bajaj", "Principal", 31, 0],
  ["1227", "KIT YAMAHA XTZ 150 SIN FAROLA ARENA", "Yamaha", "Principal", 8, 0],
  ["1335", "KIT PULSAR NS 125-150-160 ROJO CHERRY", "Bajaj", "Principal", 5, 0],
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

export const demoReorderWatchlist: ReorderWatchItem[] = demoCurrent
  .slice(6, 11)
  .map((item, index) => ({
    id: `demo-watch-${index}`,
    sku: item.sku,
    productName: item.productName,
    supplier: index % 2 ? "Proveedor Norte" : "Proveedor principal",
    reorderPoint: 10,
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
