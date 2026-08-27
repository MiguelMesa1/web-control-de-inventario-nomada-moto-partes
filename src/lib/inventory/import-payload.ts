import type { InventoryItem } from "@/types/inventory";

// Leave room below the 4.5 MB request limit of the production function host.
export const MAX_IMPORT_BODY_BYTES = 4_400_000;

export function serializeInventoryImport(filename: string, checksum: string, sourceExportedAt: string, items: InventoryItem[]) {
  const body = JSON.stringify({ filename, checksum, sourceExportedAt,
    items: items.map((item) => ({ sku: item.sku, productName: item.productName,
      productLine: item.productLine, warehouse: item.warehouse, stock: item.stock,
      reserved: item.reserved, available: item.available })),
  });
  if (new TextEncoder().encode(body).byteLength > MAX_IMPORT_BODY_BYTES) {
    throw new Error("Los datos del inventario superan el límite de publicación de 4,4 MB. No se publicó ninguna fila.");
  }
  return body;
}
