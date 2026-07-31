import Papa from "papaparse";
import type { InventoryItem } from "@/types/inventory";

type RawRow = Record<string, unknown>;

const headerAliases = {
  sku: ["sku", "referencia", "codigo", "codigo producto", "cod producto"],
  productName: ["producto", "nombre", "nombre producto", "descripcion"],
  productLine: [
    "linea",
    "linea producto",
    "categoria",
    "familia",
    "marca",
  ],
  warehouse: ["bodega", "almacen", "ubicacion"],
  stock: [
    "existencia",
    "stock",
    "cantidad",
    "existencia fisica",
    "stock total empresa",
  ],
  principalStock: ["stock bodega: principal (sucursal: principal)"],
  reserved: ["reservado", "cantidad reservada", "comprometido"],
  available: ["disponible", "cantidad disponible", "saldo disponible"],
} as const;

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function findValue(row: RawRow, aliases: readonly string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
  );
  for (const alias of aliases) {
    if (normalized.has(alias)) return normalized.get(alias);
  }
  return undefined;
}

function isEffiConsolidatedExport(rows: RawRow[]) {
  const headers = new Set(
    Object.keys(rows[0] ?? {}).map((header) => normalizeHeader(header)),
  );
  return (
    headers.has("referencia") &&
    headers.has("nombre") &&
    headers.has("marca") &&
    headers.has("stock total empresa")
  );
}

function hasPrincipalWarehouseStock(rows: RawRow[]) {
  const headers = new Set(
    Object.keys(rows[0] ?? {}).map((header) => normalizeHeader(header)),
  );
  return headerAliases.principalStock.some((header) => headers.has(header));
}

function numericValue(value: unknown, field: string, rowNumber: number) {
  if (value === undefined || value === null || value === "") return 0;
  const normalized =
    typeof value === "string"
      ? value
          .replace(/\$/g, "")
          .replace(/\s/g, "")
          .replace(/\.(?=\d{3}(?:\D|$))/g, "")
          .replace(",", ".")
      : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new Error(`Fila ${rowNumber}: “${field}” debe ser un número válido.`);
  }
  return number;
}

export function normalizeInventoryRows(
  rows: RawRow[],
  sourceExportedAt = new Date().toISOString(),
): InventoryItem[] {
  if (!rows.length) {
    throw new Error("El archivo está vacío. Revisa la exportación e intenta de nuevo.");
  }

  const effiConsolidated = isEffiConsolidatedExport(rows);
  const principalWarehouseStock = hasPrincipalWarehouseStock(rows);
  const inventoryRows = rows.filter((row) => {
    if (!Object.values(row).some((value) => String(value ?? "").trim())) {
      return false;
    }
    if (!effiConsolidated) return true;

    const sku = String(findValue(row, headerAliases.sku) ?? "").trim();
    const stock = findValue(
      row,
      principalWarehouseStock
        ? headerAliases.principalStock
        : headerAliases.stock,
    );
    return Boolean(sku) && Number.isFinite(Number(stock));
  });

  if (!inventoryRows.length) {
    throw new Error("El archivo no contiene referencias con inventario numérico.");
  }

  const seen = new Set<string>();
  return inventoryRows.map((row, index) => {
    const rowNumber = index + 2;
    const sku = String(findValue(row, headerAliases.sku) ?? "").trim();
    const productName = String(
      findValue(row, headerAliases.productName) ?? "",
    ).trim();
    const productLine = String(
      findValue(row, headerAliases.productLine) ?? "",
    ).trim();
    const warehouse = String(
      findValue(row, headerAliases.warehouse) ??
        (principalWarehouseStock ? "Principal" : effiConsolidated ? "Empresa" : ""),
    ).trim();
    const normalizedLine =
      productLine || (effiConsolidated ? "Sin marca" : "");

    const missing = [
      !sku && "SKU/referencia",
      !productName && "producto",
      !normalizedLine && "línea",
      !warehouse && "bodega",
    ].filter(Boolean);

    if (missing.length) {
      throw new Error(`Fila ${rowNumber}: faltan ${missing.join(", ")}.`);
    }

    const key = `${sku.toLowerCase()}::${warehouse.toLowerCase()}`;
    if (seen.has(key)) {
      throw new Error(
        `Fila ${rowNumber}: la referencia ${sku} está repetida en ${warehouse}. Corrige el duplicado en Effi antes de publicar.`,
      );
    }
    seen.add(key);

    const stock = numericValue(
      findValue(
        row,
        principalWarehouseStock
          ? headerAliases.principalStock
          : headerAliases.stock,
      ),
      "existencia",
      rowNumber,
    );
    const reserved = numericValue(
      findValue(row, headerAliases.reserved),
      "reservado",
      rowNumber,
    );
    const availableRaw = findValue(row, headerAliases.available);
    const available =
      availableRaw === undefined
        ? stock - reserved
        : numericValue(availableRaw, "disponible", rowNumber);

    return {
      sku,
      productName,
      productLine: normalizedLine,
      warehouse,
      stock,
      reserved,
      available,
      sourceExportedAt,
    };
  });
}

export async function parseInventoryFile(
  file: File,
  sourceExportedAt = new Date().toISOString(),
) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
    throw new Error("Formato no permitido. Usa un archivo CSV, XLSX o XLS.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }

  let rows: RawRow[];
  if (extension === "csv") {
    const text = await file.text();
    const result = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });
    if (result.errors.length) {
      throw new Error(`No pudimos leer el CSV: ${result.errors[0].message}`);
    }
    rows = result.data;
  } else {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("El Excel no contiene hojas.");
    rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
      defval: "",
    });
  }

  const items = normalizeInventoryRows(rows, sourceExportedAt);
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const checksum = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return { items, checksum };
}
