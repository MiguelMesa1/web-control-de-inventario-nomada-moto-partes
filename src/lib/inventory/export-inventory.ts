import * as XLSX from "xlsx";
import type { InventoryItem } from "@/types/inventory";

export type InventoryExcelDownload = {
  blob: Blob;
  filename: string;
};

export function createInventoryWorkbook(items: InventoryItem[]) {
  const rows = items.map((item) => ({
    SKU: item.sku,
    Producto: item.productName,
    "Línea": item.productLine,
    Existencia: item.stock,
    "Costo unitario": item.unitCost ?? null,
    "Costo total": item.unitCost == null ? null : Math.round(item.stock * item.unitCost * 100) / 100,
    Disponible: item.available,
    Fecha: item.sourceExportedAt.slice(0, 10),
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["SKU", "Producto", "Línea", "Existencia", "Costo unitario", "Costo total", "Disponible", "Fecha"],
  });

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 48 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 13 },
  ];
  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
  }
  for (let row = 2; row <= rows.length + 1; row += 1) {
    const stockCell = worksheet[`D${row}`];
    const unitCostCell = worksheet[`E${row}`];
    const totalCostCell = worksheet[`F${row}`];
    const availableCell = worksheet[`G${row}`];
    if (stockCell) stockCell.z = "#,##0.00";
    if (unitCostCell) unitCostCell.z = "#,##0.00";
    if (totalCostCell) totalCostCell.z = "#,##0.00";
    if (availableCell) availableCell.z = "#,##0.00";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
  workbook.Props = {
    Title: "Inventario Nómada",
    Subject: "Existencias y disponibilidad",
    Company: "Nómada Moto Partes",
  };
  return workbook;
}

export function createInventoryExcel(
  items: InventoryItem[],
  date = new Date().toISOString().slice(0, 10),
): InventoryExcelDownload {
  if (!items.length) throw new Error("No hay inventario para exportar.");

  const bytes = XLSX.write(createInventoryWorkbook(items), {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;

  return {
    blob: new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: `inventario-nomada-${date}.xlsx`,
  };
}

export function downloadInventoryExcel(items: InventoryItem[]) {
  const download = createInventoryExcel(items);
  const url = URL.createObjectURL(download.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return download;
}
