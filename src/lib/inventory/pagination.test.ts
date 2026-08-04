import { describe, expect, it, vi } from "vitest";
import { loadAllPages } from "@/lib/inventory/pagination";

describe("loadAllPages", () => {
  it("termina cuando una pagina tiene menos filas que el limite", async () => {
    const loadPage = vi.fn().mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
      error: null,
    });

    await expect(loadAllPages(loadPage, 3)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(loadPage).toHaveBeenCalledOnce();
    expect(loadPage).toHaveBeenCalledWith(0, 2);
  });

  it("carga paginas completas de forma secuencial y sin conteo total", async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const pages = [
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }, { id: 4 }],
      [{ id: 5 }],
    ];
    const loadPage = vi.fn(async () => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await Promise.resolve();
      const data = pages.shift() ?? [];
      activeRequests -= 1;
      return { data, error: null };
    });

    await expect(loadAllPages(loadPage, 2)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
    expect(maximumActiveRequests).toBe(1);
    expect(loadPage.mock.calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("detiene la paginacion al recibir un error", async () => {
    const loadPage = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "consulta agotada" },
    });

    await expect(loadAllPages(loadPage)).rejects.toThrow("consulta agotada");
    expect(loadPage).toHaveBeenCalledOnce();
  });
});
