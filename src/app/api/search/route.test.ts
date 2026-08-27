import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAppProfile, searchGlobalCatalog } = vi.hoisted(() => ({
  getAppProfile: vi.fn(),
  searchGlobalCatalog: vi.fn(),
}));

vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/search/global-search", () => ({ searchGlobalCatalog }));

import { GET } from "./route";

describe("/api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppProfile.mockResolvedValue({ id: "user-1", role: "reader" });
  });

  it("rechaza búsquedas demasiado cortas", async () => {
    const response = await GET(
      new Request("https://inventario.example/api/search?q=a"),
    );
    expect(response.status).toBe(400);
    expect(searchGlobalCatalog).not.toHaveBeenCalled();
  });

  it("devuelve los resultados del catálogo sin cachearlos", async () => {
    searchGlobalCatalog.mockResolvedValue({
      products: [{ sku: "NM-001" }],
      lines: [],
      orders: [],
    });
    const response = await GET(
      new Request("https://inventario.example/api/search?q=Pastillas"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(searchGlobalCatalog).toHaveBeenCalledWith("Pastillas");
  });
});
