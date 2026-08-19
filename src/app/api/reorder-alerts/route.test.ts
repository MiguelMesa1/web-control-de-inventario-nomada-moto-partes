import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAppProfile, loadReorderAlertData } = vi.hoisted(() => ({
  getAppProfile: vi.fn(),
  loadReorderAlertData: vi.fn(),
}));

vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/inventory/data", () => ({ loadReorderAlertData }));

import { GET } from "./route";

describe("GET /api/reorder-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppProfile.mockResolvedValue({ id: "user-1", role: "admin" });
  });

  it("oculta de la campana las referencias con un pedido activo", async () => {
    loadReorderAlertData.mockResolvedValue({
      current: [
        {
          sku: "SKU-ACTIVO",
          productName: "Producto ya pedido",
          productLine: "Motor",
          warehouse: "Principal",
          stock: 0,
          reserved: 0,
          available: 0,
          snapshotId: "snapshot-1",
          sourceExportedAt: "2026-08-19T12:00:00.000Z",
        },
        {
          sku: "SKU-PENDIENTE",
          productName: "Producto pendiente",
          productLine: "Motor",
          warehouse: "Principal",
          stock: 1,
          reserved: 0,
          available: 1,
          snapshotId: "snapshot-1",
          sourceExportedAt: "2026-08-19T12:00:00.000Z",
        },
      ],
      reorderWatchlist: [
        {
          id: "watch-active",
          sku: "SKU-ACTIVO",
          productName: "Producto ya pedido",
          primarySupplier: "Proveedor A",
          minimumStock: 5,
          maximumStock: 10,
          active: true,
          createdAt: "2026-08-19T12:00:00.000Z",
          updatedAt: "2026-08-19T12:00:00.000Z",
        },
        {
          id: "watch-pending",
          sku: "SKU-PENDIENTE",
          productName: "Producto pendiente",
          primarySupplier: "Proveedor B",
          minimumStock: 5,
          maximumStock: 10,
          active: true,
          createdAt: "2026-08-19T12:00:00.000Z",
          updatedAt: "2026-08-19T12:00:00.000Z",
        },
      ],
      activeOrderSkus: ["SKU-ACTIVO"],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.alerts).toHaveLength(1);
    expect(payload.total).toBe(1);
    expect(payload.alerts[0]).toMatchObject({ sku: "SKU-PENDIENTE" });
  });

  it("informa el total real aunque el menú muestre solo seis alertas", async () => {
    const current = Array.from({ length: 7 }, (_, index) => ({
      sku: `SKU-${index + 1}`,
      productName: `Producto ${index + 1}`,
      productLine: "Motor",
      warehouse: "Principal",
      stock: 0,
      reserved: 0,
      available: 0,
      snapshotId: "snapshot-1",
      sourceExportedAt: "2026-08-19T12:00:00.000Z",
    }));
    const reorderWatchlist = current.map((item, index) => ({
      id: `watch-${index + 1}`,
      sku: item.sku,
      productName: item.productName,
      primarySupplier: "Proveedor",
      minimumStock: 5,
      maximumStock: 10,
      active: true,
      createdAt: "2026-08-19T12:00:00.000Z",
      updatedAt: "2026-08-19T12:00:00.000Z",
    }));
    loadReorderAlertData.mockResolvedValue({
      current,
      reorderWatchlist,
      activeOrderSkus: [],
    });

    const response = await GET();
    const payload = await response.json();

    expect(payload.total).toBe(7);
    expect(payload.alerts).toHaveLength(6);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
