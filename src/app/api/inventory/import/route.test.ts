import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  after,
  revalidatePath,
  consumeDistributedRateLimit,
  createInsForgeServerClient,
  getAppProfile,
  loadActiveOrderSkus,
  recordEmailDeliveryAttempt,
  sendBrevoEmail,
} = vi.hoisted(() => ({
  after: vi.fn(),
  revalidatePath: vi.fn(),
  consumeDistributedRateLimit: vi.fn(),
  createInsForgeServerClient: vi.fn(),
  getAppProfile: vi.fn(),
  loadActiveOrderSkus: vi.fn(),
  recordEmailDeliveryAttempt: vi.fn(),
  sendBrevoEmail: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(), after,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/security/distributed-rate-limit", () => ({ consumeDistributedRateLimit }));

vi.mock("@/lib/email/brevo-smtp", () => ({ sendBrevoEmail }));
vi.mock("@/lib/email/delivery-attempts", () => ({
  recordEmailDeliveryAttempt,
}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/orders/active-order-data", () => ({ loadActiveOrderSkus }));

import { POST, reorderEmailStatusLabel } from "./route";

const requestBody = {
  filename: "inventario.xlsx",
  checksum: "a".repeat(64),
  sourceExportedAt: "2026-07-30T05:00:00.000Z",
  items: [
    {
      sku: "SKU-1",
      productName: "Producto de prueba",
      productLine: "Motor",
      warehouse: "Principal",
      stock: 5,
      reserved: 0,
      available: 5,
      sourceExportedAt: "2026-07-30T05:00:00.000Z",
    },
  ],
};

describe("POST /api/inventory/import", () => {
  it("distingue en el correo un producto ausente del inventario", () => {
    expect(reorderEmailStatusLabel("missing")).toBe("Sin registro");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    consumeDistributedRateLimit.mockResolvedValue({ allowed: true });
    getAppProfile.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      displayName: "Usuario administrador",
      role: "admin",
    });
    sendBrevoEmail.mockResolvedValue({
      accepted: ["admin@example.com"],
      rejected: [],
      messageId: "brevo-message-1",
      response: "250 2.0.0 OK",
    });
    recordEmailDeliveryAttempt.mockResolvedValue(undefined);
    loadActiveOrderSkus.mockResolvedValue([]);
  });

  it("rejects uploads from viewers before reading or writing data", async () => {
    getAppProfile.mockResolvedValueOnce({ id: "viewer", role: "viewer" });
    const response = await POST(new Request("https://inventario.example/api/inventory/import", {
      method: "POST", headers: { origin: "https://inventario.example", "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }));
    expect(response.status).toBe(403);
    expect(createInsForgeServerClient).not.toHaveBeenCalled();
  });

  it("enforces the distributed per-user import limit before publication", async () => {
    consumeDistributedRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 45 });
    const response = await POST(new Request("https://inventario.example/api/inventory/import", {
      method: "POST", headers: { origin: "https://inventario.example", "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
    expect(createInsForgeServerClient).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("mantiene la publicación exitosa si falla el cálculo de recompra", async () => {
    createInsForgeServerClient.mockResolvedValue({
      database: {
        rpc: vi.fn().mockResolvedValue({ data: "snapshot-1", error: null }),
        from: vi.fn((table: string) => {
          if (table === "reorder_watchlist") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "No pudimos consultar la recompra." },
                }),
              })),
            };
          }

          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      },
    });

    const response = await POST(
      new Request("https://inventario.example/api/inventory/import", {
        method: "POST",
        headers: {
          origin: "https://inventario.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
    );
    const payload = await response.json();
    expect(after).toHaveBeenCalledOnce();
    await after.mock.calls[0][0]();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      data: "snapshot-1",
      notificationsPending: true,
    });
  });

  it("registra la respuesta de Brevo cuando el correo es aceptado", async () => {
    createInsForgeServerClient.mockResolvedValue({
      database: {
        rpc: vi.fn().mockResolvedValue({ data: "snapshot-success", error: null }),
        from: vi.fn((table: string) => {
          if (table === "reorder_watchlist") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "watch-1",
                      source_id: 1,
                      sku: "SKU-1",
                      product_name: "Producto de prueba",
                      primary_supplier: "Proveedor principal",
                      secondary_supplier: "Proveedor alterno",
                      minimum_stock: 5,
                      maximum_stock: 12,
                      active: true,
                      notes: null,
                      created_at: "2026-07-30T05:00:00.000Z",
                      updated_at: "2026-07-30T05:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              })),
            };
          }

          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      },
    });

    const response = await POST(
      new Request("https://inventario.example/api/inventory/import", {
        method: "POST",
        headers: {
          origin: "https://inventario.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
    );
    const payload = await response.json();
    // No SMTP or notification queries on the critical response path.
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(recordEmailDeliveryAttempt).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
    await after.mock.calls[0][0]();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      data: "snapshot-success",
      notificationsPending: true,
    });
    expect(recordEmailDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: "snapshot-success",
        recipientEmail: "admin@example.com",
        status: "sent",
        alertCount: 1,
        providerMessageId: "brevo-message-1",
        providerResponse: "250 2.0.0 OK",
      }),
    );
  });

  it("no vuelve a notificar una referencia que ya tiene pedido activo", async () => {
    loadActiveOrderSkus.mockResolvedValue(["SKU-1"]);
    createInsForgeServerClient.mockResolvedValue({
      database: {
        rpc: vi.fn().mockResolvedValue({ data: "snapshot-active", error: null }),
        from: vi.fn((table: string) => {
          if (table === "reorder_watchlist") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "watch-1",
                      source_id: 1,
                      sku: "SKU-1",
                      product_name: "Producto de prueba",
                      primary_supplier: "Proveedor principal",
                      secondary_supplier: null,
                      minimum_stock: 5,
                      maximum_stock: 12,
                      active: true,
                      notes: null,
                      created_at: "2026-07-30T05:00:00.000Z",
                      updated_at: "2026-07-30T05:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              })),
            };
          }

          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      },
    });

    const response = await POST(
      new Request("https://inventario.example/api/inventory/import", {
        method: "POST",
        headers: {
          origin: "https://inventario.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
    );
    const payload = await response.json();
    await after.mock.calls[0][0]();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      data: "snapshot-active",
      notificationsPending: true,
    });
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(recordEmailDeliveryAttempt).not.toHaveBeenCalled();
  });

  it("mantiene la publicación exitosa si falla el correo de recompra", async () => {
    sendBrevoEmail.mockRejectedValueOnce(
      new Error("El servicio de correo no está disponible."),
    );
    createInsForgeServerClient.mockResolvedValue({
      database: {
        rpc: vi.fn().mockResolvedValue({ data: "snapshot-2", error: null }),
        from: vi.fn((table: string) => {
          if (table === "reorder_watchlist") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "watch-1",
                      source_id: 1,
                      sku: "SKU-1",
                      product_name: "Producto de prueba",
                      primary_supplier: "Proveedor principal",
                      secondary_supplier: "Proveedor alterno",
                      minimum_stock: 5,
                      maximum_stock: 12,
                      active: true,
                      notes: null,
                      created_at: "2026-07-30T05:00:00.000Z",
                      updated_at: "2026-07-30T05:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              })),
            };
          }

          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      },
    });

    const response = await POST(
      new Request("https://inventario.example/api/inventory/import", {
        method: "POST",
        headers: {
          origin: "https://inventario.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
    );
    const payload = await response.json();
    await after.mock.calls[0][0]();

    expect(response.status).toBe(200);
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        subject: "Reposición requerida: 1 referencia por revisar",
      }),
    );
    expect(payload).toMatchObject({
      data: "snapshot-2",
      notificationsPending: true,
    });
    expect(recordEmailDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: "snapshot-2",
        recipientEmail: "admin@example.com",
        status: "failed",
        alertCount: 1,
        errorMessage: "El servicio de correo no está disponible.",
      }),
    );
  });
});
