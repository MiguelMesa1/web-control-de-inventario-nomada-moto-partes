import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseInventoryInWorker } from "./parse-in-worker";

class FakeWorker {
  static instance: FakeWorker;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { FakeWorker.instance = this; }
}

describe("inventory worker lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("Worker", FakeWorker); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("returns parsed data and terminates the worker", async () => {
    const promise = parseInventoryInWorker(new File(["csv"], "test.csv"), "2026-08-01");
    FakeWorker.instance.onmessage!({ data: { result: { items: [], checksum: "hash" } } });
    await expect(promise).resolves.toEqual({ items: [], checksum: "hash" });
    expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("terminates parsing on navigation/cancellation", async () => {
    const controller = new AbortController();
    const promise = parseInventoryInWorker(new File(["csv"], "test.csv"), "2026-08-01", controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow("cancelada");
    expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("bounds processing time for pathological files", async () => {
    const promise = parseInventoryInWorker(new File(["csv"], "test.csv"), "2026-08-01");
    const assertion = expect(promise).rejects.toThrow("demasiado");
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(FakeWorker.instance.terminate).toHaveBeenCalledOnce();
  });
});
