import { parseInventoryFile } from "./parser";

self.onmessage = async (event: MessageEvent<{ file: File; sourceExportedAt: string }>) => {
  try {
    const result = await parseInventoryFile(event.data.file, event.data.sourceExportedAt);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "No pudimos leer el archivo." });
  }
};
