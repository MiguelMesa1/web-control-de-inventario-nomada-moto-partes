import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuthenticatedInsForgeServerClient } = vi.hoisted(() => ({
  createAuthenticatedInsForgeServerClient: vi.fn(),
}));

vi.mock("@/lib/insforge/authenticated-server", () => ({
  createAuthenticatedInsForgeServerClient,
}));

import { loadPurchaseOrderHistoryPage } from "@/lib/inventory/data";

describe("paginación del historial de pedidos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carga treinta pedidos y conserva un registro extra para detectar la siguiente página", async () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({
      id: `order-${index + 31}`,
      order_number: `PED-${index + 31}`,
      supplier_name: "Proveedor",
      status: "received",
      notes: null,
      created_at: new Date(2026, 7, 19, 12, 0, -index).toISOString(),
      updated_at: new Date(2026, 7, 19, 12, 0, -index).toISOString(),
    }));
    const recentQuery = {
      select: vi.fn(),
      lte: vi.fn(),
      range: vi.fn(),
      order: vi.fn(),
    };
    recentQuery.select.mockReturnValue(recentQuery);
    recentQuery.lte.mockReturnValue(recentQuery);
    recentQuery.order.mockReturnValue(recentQuery);
    recentQuery.range.mockResolvedValue({ data: rows, error: null });

    const itemQuery = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    itemQuery.select.mockReturnValue(itemQuery);
    itemQuery.in.mockReturnValue(itemQuery);
    itemQuery.order.mockReturnValue(itemQuery);
    itemQuery.range.mockResolvedValue({ data: [], error: null });

    createAuthenticatedInsForgeServerClient.mockResolvedValue({
      database: {
        from: vi
          .fn()
          .mockReturnValueOnce(recentQuery)
          .mockReturnValueOnce(itemQuery),
      },
    });

    const snapshotBefore = "2026-08-19T12:00:00.000Z";
    const result = await loadPurchaseOrderHistoryPage(30, 30, snapshotBefore);

    expect(recentQuery.lte).toHaveBeenCalledWith("created_at", snapshotBefore);
    expect(recentQuery.range).toHaveBeenCalledWith(30, 60);
    expect(result.orders).toHaveLength(30);
    expect(result.page).toEqual({
      hasMore: true,
      nextOffset: 60,
      snapshotBefore,
    });
  });
});
