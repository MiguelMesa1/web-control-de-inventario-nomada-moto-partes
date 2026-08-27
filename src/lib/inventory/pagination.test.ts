import { describe, expect, it, vi } from "vitest";
import { loadAllPages, loadSnapshotPages } from "@/lib/inventory/pagination";

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

describe("loadSnapshotPages", () => {
  it("loads immutable pages with at most three concurrent requests and preserves order", async () => {
    let active = 0;
    let maximum = 0;
    const source = Array.from({ length: 13 }, (_, id) => ({ id }));
    const load = vi.fn(async (from: number, to: number) => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return { data: source.slice(from, to + 1), error: null };
    });
    expect(await loadSnapshotPages(load, source.length, 2)).toEqual(source);
    expect(maximum).toBe(3);
    expect(load.mock.calls).toEqual([[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 12]]);
  });

  it("fails rather than silently showing a partial snapshot", async () => {
    await expect(loadSnapshotPages(async () => ({ data: [{ id: 1 }], error: null }), 2)).rejects.toThrow("incompleta");
    await expect(loadSnapshotPages(async () => ({ data: null, error: { message: "denied" } }), 2)).rejects.toThrow("denied");
  });
});
