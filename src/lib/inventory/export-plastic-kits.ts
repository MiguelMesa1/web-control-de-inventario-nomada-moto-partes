import * as XLSX from "xlsx";
import { getPlasticKitModel } from "@/lib/inventory/plastic-kit-taxonomy";
import type { PlasticKitAvailability } from "@/types/inventory";

export type PlasticKitsExcelDownload = {
  blob: Blob;
  filename: string;
};

function headlightLabel(kit: PlasticKitAvailability) {
  if (kit.hasHeadlight === null) return "No aplica";
  return kit.hasHeadlight ? "Con farola" : "Sin farola";
}

export function createPlasticKitsWorkbook(kits: PlasticKitAvailability[]) {
  const rows = kits.map((kit) => ({
    Kit: kit.name,
    Modelo: getPlasticKitModel(kit),
    Color: kit.color,
    Farola: headlightLabel(kit),
    Piezas: kit.parts.length,
    "Kits armables": kit.available,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["Kit", "Modelo", "Color", "Farola", "Piezas", "Kits armables"],
  });

  worksheet["!cols"] = [
    { wch: 38 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
  ];
  if (worksheet["!ref"]) {
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };
  }
  for (let row = 2; row <= rows.length + 1; row += 1) {
    const partsCell = worksheet[`E${row}`];
    const availableCell = worksheet[`F${row}`];
    if (partsCell) partsCell.z = "#,##0";
    if (availableCell) availableCell.z = "#,##0";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Kits plásticos");
  workbook.Props = {
    Title: "Kits plásticos Nómada",
    Subject: "Disponibilidad de kits plásticos",
    Company: "Nómada Moto Partes",
  };
  return workbook;
}

export function createPlasticKitsExcel(
  kits: PlasticKitAvailability[],
  date = new Date().toISOString().slice(0, 10),
): PlasticKitsExcelDownload {
  if (!kits.length) throw new Error("No hay kits para exportar.");

  const bytes = XLSX.write(createPlasticKitsWorkbook(kits), {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;

  return {
    blob: new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: `kits-plastico-nomada-${date}.xlsx`,
  };
}

export function downloadPlasticKitsExcel(kits: PlasticKitAvailability[]) {
  const download = createPlasticKitsExcel(kits);
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
