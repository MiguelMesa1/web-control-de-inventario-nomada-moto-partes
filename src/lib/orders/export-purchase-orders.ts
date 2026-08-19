import JSZip from "jszip";
import * as XLSX from "xlsx";

export type PurchaseOrderExportItem = {
  sku: string;
  productName: string;
  quantity: number;
};

export type PurchaseOrderExportGroup = {
  supplierName: string;
  items: PurchaseOrderExportItem[];
};

export type PurchaseOrderDownload = {
  blob: Blob;
  filename: string;
  fileCount: number;
};

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase()
    .slice(0, 70);

  return normalized || "proveedor";
}

function buildWorkbook(group: PurchaseOrderExportGroup) {
  const rows = group.items.map((item) => ({
    Referencia: String(item.sku),
    Nombre: item.productName,
    "Cantidad a solicitar": item.quantity,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["Referencia", "Nombre", "Cantidad a solicitar"],
  });

  worksheet["!cols"] = [{ wch: 22 }, { wch: 58 }, { wch: 22 }];
  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
  }
  for (let row = 2; row <= rows.length + 1; row += 1) {
    const quantityCell = worksheet[`C${row}`];
    if (quantityCell) quantityCell.z = "#,##0";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pedido");
  workbook.Props = {
    Title: `Pedido a ${group.supplierName}`,
    Subject: "Productos a solicitar",
    Company: "Nómada Moto Partes",
  };
  return workbook;
}

function workbookBytes(group: PurchaseOrderExportGroup) {
  return XLSX.write(buildWorkbook(group), {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;
}

function uniqueSupplierFilename(
  supplierName: string,
  date: string,
  usedNames: Set<string>,
) {
  const base = `pedido-${safeFilename(supplierName)}-${date}`;
  let candidate = `${base}.xlsx`;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    candidate = `${base}-${suffix}.xlsx`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

export async function createPurchaseOrderDownload(
  groups: PurchaseOrderExportGroup[],
  date = new Date().toISOString().slice(0, 10),
): Promise<PurchaseOrderDownload> {
  const populatedGroups = groups.filter((group) => group.items.length > 0);
  if (!populatedGroups.length) {
    throw new Error("No hay productos para exportar.");
  }

  const usedNames = new Set<string>();
  const files = populatedGroups.map((group) => ({
    filename: uniqueSupplierFilename(group.supplierName, date, usedNames),
    bytes: workbookBytes(group),
  }));

  if (files.length === 1) {
    return {
      blob: new Blob([files[0].bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename: files[0].filename,
      fileCount: 1,
    };
  }

  const zip = new JSZip();
  for (const file of files) zip.file(file.filename, file.bytes);

  return {
    blob: await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
    filename: `pedidos-por-proveedor-${date}.zip`,
    fileCount: files.length,
  };
}

export async function downloadPurchaseOrderFiles(
  groups: PurchaseOrderExportGroup[],
) {
  const download = await createPurchaseOrderDownload(groups);
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
