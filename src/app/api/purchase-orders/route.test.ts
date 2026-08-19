import { beforeEach, describe, expect, it, vi } from "vitest";

const { createInsForgeServerClient, getAppProfile, loadPurchaseOrderHistoryPage, loadActiveOrderSkus } = vi.hoisted(() => ({
  createInsForgeServerClient: vi.fn(),
  getAppProfile: vi.fn(),
  loadPurchaseOrderHistoryPage: vi.fn(),
  loadActiveOrderSkus: vi.fn(),
}));

vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/inventory/data", () => ({ loadPurchaseOrderHistoryPage }));
vi.mock("@/lib/orders/active-order-data", () => ({ loadActiveOrderSkus }));

import { GET, POST } from "./route";

const validOrder = {
  supplierName: "REDPLAS",
  items: [
    {
      sku: "2220201",
      productName: "Carenaje Boxer",
      quantity: 111,
      available: 110,
      minimumStock: 110,
      maximumStock: 221,
    },
  ],
};

function request(body: unknown) {
  return new Request("https://inventario.example/api/purchase-orders", {
    method: "POST",
    headers: {
      origin: "https://inventario.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/purchase-orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppProfile.mockResolvedValue({
      id: "user-1",
      role: "admin",
    });
    loadActiveOrderSkus.mockResolvedValue([]);
  });

  it("carga una página de pedidos anteriores", async () => {
    loadPurchaseOrderHistoryPage.mockResolvedValue({
      orders: [{ id: "order-31", orderNumber: "PED-31" }],
      page: {
        hasMore: true,
        nextOffset: 60,
        snapshotBefore: "2026-08-19T12:00:00.000Z",
      },
    });

    const response = await GET(
      new Request(
        "https://inventario.example/api/purchase-orders?offset=30&before=2026-08-19T12%3A00%3A00.000Z",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadPurchaseOrderHistoryPage).toHaveBeenCalledWith(
      30,
      30,
      "2026-08-19T12:00:00.000Z",
    );
    expect(body.page).toEqual({
      hasMore: true,
      nextOffset: 60,
      snapshotBefore: "2026-08-19T12:00:00.000Z",
    });
  });

  it("rechaza un desplazamiento de historial inválido", async () => {
    const response = await GET(
      new Request("https://inventario.example/api/purchase-orders?offset=-1"),
    );

    expect(response.status).toBe(400);
    expect(loadPurchaseOrderHistoryPage).not.toHaveBeenCalled();
  });

  it("crea pedidos agrupados mediante una operación transaccional", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "order-1", orderNumber: "PED-20260814-ABC123" }],
      error: null,
    });
    createInsForgeServerClient.mockResolvedValue({ database: { rpc } });

    const response = await POST(request({ orders: [validOrder] }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_purchase_orders", {
      p_orders: [validOrder],
    });
  });

  it("rechaza una referencia que ya está en un pedido pendiente", async () => {
    loadActiveOrderSkus.mockResolvedValue(["2220201"]);
    const rpc = vi.fn();
    createInsForgeServerClient.mockResolvedValue({ database: { rpc } });

    const response = await POST(request({ orders: [validOrder] }));
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(409);
    expect(body.message).toContain("2220201");
    expect(body.message).toContain("Confirma que llegó");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza cantidades inválidas antes de consultar la base", async () => {
    const response = await POST(
      request({
        orders: [
          {
            ...validOrder,
            items: [{ ...validOrder.items[0], quantity: 0 }],
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(createInsForgeServerClient).not.toHaveBeenCalled();
  });

  it("impide gestionar pedidos a un perfil de consulta", async () => {
    getAppProfile.mockResolvedValue({ id: "reader-1", role: "reader" });

    const response = await POST(request({ orders: [validOrder] }));

    expect(response.status).toBe(403);
    expect(createInsForgeServerClient).not.toHaveBeenCalled();
  });
});
