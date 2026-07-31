import { beforeEach, describe, expect, it, vi } from "vitest";

const { createInsForgeServerClient, getAppProfile, sendBrevoEmail } = vi.hoisted(() => ({
  createInsForgeServerClient: vi.fn(),
  getAppProfile: vi.fn(),
  sendBrevoEmail: vi.fn(),
}));

vi.mock("@/lib/email/brevo-smtp", () => ({ sendBrevoEmail }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));

import { POST } from "./route";

const requestBody = {
  filename: "inventario.xlsx",
  checksum: "checksum-unico",
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
  beforeEach(() => {
    vi.clearAllMocks();
    getAppProfile.mockResolvedValue({
      id: "user-1",
      email: "admin@example.com",
      displayName: "Usuario administrador",
      role: "admin",
    });
    sendBrevoEmail.mockResolvedValue(undefined);
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

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      data: "snapshot-1",
      reorderCount: 0,
      reorderWarning: "No pudimos consultar la recompra.",
    });
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
                      supplier: null,
                      reorder_point: 5,
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

    expect(response.status).toBe(200);
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.com",
        subject: "Stock bajo: 1 referencias por revisar",
      }),
    );
    expect(payload).toMatchObject({
      data: "snapshot-2",
      reorderCount: 1,
      emailWarning: "El servicio de correo no está disponible.",
    });
  });
});
