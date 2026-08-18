import { beforeEach, describe, expect, it, vi } from "vitest";

const { createInsForgeServerClient, getAppProfile } = vi.hoisted(() => ({
  createInsForgeServerClient: vi.fn(),
  getAppProfile: vi.fn(),
}));

vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));

import { POST } from "./route";

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

describe("POST /api/purchase-orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppProfile.mockResolvedValue({
      id: "user-1",
      role: "admin",
    });
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
