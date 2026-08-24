import { beforeEach, describe, expect, it, vi } from "vitest";

const { createInsForgeServerClient, getAppProfile, recordAuditEvent } = vi.hoisted(() => ({
  createInsForgeServerClient: vi.fn(),
  getAppProfile: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent }));

import { DELETE } from "./route";

const attachmentId = "10000000-0000-4000-8000-000000000001";
const ownerId = "20000000-0000-4000-8000-000000000002";
const otherUserId = "30000000-0000-4000-8000-000000000003";

function deleteRequest() {
  return new Request(`https://inventario.example/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: { origin: "https://inventario.example" },
  });
}

function client() {
  const single = vi.fn().mockResolvedValue({
    data: {
      id: attachmentId,
      sku: "SKU-1",
      file_name: "ficha.pdf",
      file_key: "SKU-1/ficha.pdf",
      mime_type: "application/pdf",
      uploaded_by: ownerId,
    },
    error: null,
  });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "product_attachments") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single })),
        })),
        delete: vi.fn(() => ({ eq: deleteEq })),
      };
    }
    return { insert };
  });
  return {
    database: { from },
    storage: { from: vi.fn(() => ({ remove })) },
    spies: { deleteEq, remove },
  };
}

describe("DELETE /api/attachments/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impide que un cargador elimine el documento de otro usuario", async () => {
    const insforge = client();
    getAppProfile.mockResolvedValue({ id: otherUserId, role: "uploader" });
    createInsForgeServerClient.mockResolvedValue(insforge);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: attachmentId }),
    });

    expect(response.status).toBe(403);
    expect(insforge.spies.remove).not.toHaveBeenCalled();
    expect(insforge.spies.deleteEq).not.toHaveBeenCalled();
  });

  it("permite que el propietario elimine su documento", async () => {
    const insforge = client();
    getAppProfile.mockResolvedValue({ id: ownerId, role: "uploader" });
    createInsForgeServerClient.mockResolvedValue(insforge);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: attachmentId }),
    });

    expect(response.status).toBe(200);
    expect(insforge.spies.remove).toHaveBeenCalledWith("SKU-1/ficha.pdf");
    expect(insforge.spies.deleteEq).toHaveBeenCalledWith("id", attachmentId);
  });

  it("permite que un administrador elimine documentos de otros usuarios", async () => {
    const insforge = client();
    getAppProfile.mockResolvedValue({ id: otherUserId, role: "admin" });
    createInsForgeServerClient.mockResolvedValue(insforge);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: attachmentId }),
    });

    expect(response.status).toBe(200);
    expect(insforge.spies.remove).toHaveBeenCalledOnce();
    expect(insforge.spies.deleteEq).toHaveBeenCalledOnce();
  });
});
