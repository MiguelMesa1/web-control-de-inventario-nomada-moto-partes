import type { parseInventoryFile } from "./parser";

type ParseResult = Awaited<ReturnType<typeof parseInventoryFile>>;

export function parseInventoryInWorker(file: File, sourceExportedAt: string, signal?: AbortSignal): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const abort = () => fail("La lectura del archivo fue cancelada.");
    const timeout = setTimeout(() => fail("El archivo tardó demasiado en procesarse. Reduce su tamaño e intenta de nuevo."), 60_000);
    worker.onmessage = (event: MessageEvent<{ result?: ParseResult; error?: string }>) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? "No pudimos leer el archivo."));
    };
    worker.onerror = () => fail("No pudimos iniciar la lectura del archivo. Recarga la página e intenta de nuevo.");
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.postMessage({ file, sourceExportedAt });
  });
}
