import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import * as XLSX from "xlsx";

type ExportRow = {
  Referencia: string;
  Nombre: string;
  "Cantidad a solicitar": number;
};

async function downloadBuffer(
  stream: NodeJS.ReadableStream | null,
): Promise<ArrayBuffer> {
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function workbookRows(bytes: ArrayBuffer): ExportRow[] {
  const workbook = XLSX.read(bytes, { type: "array" });
  expect(workbook.SheetNames).toEqual(["Pedido"]);
  return XLSX.utils.sheet_to_json<ExportRow>(
    workbook.Sheets[workbook.SheetNames[0]],
  );
}

test("guarda una vez y descarga un Excel independiente por proveedor @critical", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders");

  const principalProduct = page
    .getByRole("article")
    .filter({ hasText: "Filtro de aire alto flujo" });
  const northProduct = page
    .getByRole("article")
    .filter({ hasText: "Kit cilindro 150 cc" });

  await principalProduct.getByRole("button", { name: "Agregar" }).click();
  await northProduct.getByRole("button", { name: "Agregar" }).click();

  await expect(page.getByText("Proveedor principal", { exact: true })).toBeVisible();
  await expect(page.getByText("Proveedor Norte", { exact: true })).toBeVisible();
  await page.getByLabel("Cantidad a pedir").nth(0).fill("24");
  await page.getByLabel("Cantidad a pedir").nth(1).fill("17");

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Guardar 2 borradores", exact: true })
    .click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^pedidos-por-proveedor-\d{4}-\d{2}-\d{2}\.zip$/,
  );
  const zip = await JSZip.loadAsync(
    await downloadBuffer(await download.createReadStream()),
  );
  const filenames = Object.keys(zip.files).sort();
  expect(filenames).toHaveLength(2);
  expect(filenames[0]).toMatch(/^pedido-proveedor-norte-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(filenames[1]).toMatch(
    /^pedido-proveedor-principal-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );

  const northFile = zip.file(filenames[0]);
  const principalFile = zip.file(filenames[1]);
  expect(northFile).not.toBeNull();
  expect(principalFile).not.toBeNull();
  expect(workbookRows(await northFile!.async("arraybuffer"))).toEqual([
    {
      Referencia: "NM-008",
      Nombre: "Kit cilindro 150 cc",
      "Cantidad a solicitar": 24,
    },
  ]);
  expect(workbookRows(await principalFile!.async("arraybuffer"))).toEqual([
    {
      Referencia: "NM-007",
      Nombre: "Filtro de aire alto flujo",
      "Cantidad a solicitar": 17,
    },
  ]);

  await expect(page.getByText("2 borradores guardados")).toBeVisible();
  await expect(page.getByText("Se descargó un ZIP con 2 Excel, uno por proveedor.")).toBeVisible();
});

test("vuelve a descargar el Excel de un pedido recibido desde Seguimiento @critical", async ({
  page,
}) => {
  await page.goto("/orders");
  await page.getByRole("tab", { name: /Seguimiento/ }).click();

  const order = page.getByRole("article", {
    name: "Pedido PED-DEMO-001 de Proveedor histórico",
  });
  await expect(order).toBeVisible();
  await expect(order.getByText("Creado por Administrador principal")).toBeVisible();
  await expect(
    order.getByRole("button", { name: "Cancelar pedido" }),
  ).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await order
    .getByRole("button", { name: "Descargar Excel de PED-DEMO-001" })
    .click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(
    "pedido-proveedor-historico-ped-demo-001.xlsx",
  );
  expect(
    workbookRows(await downloadBuffer(await download.createReadStream())),
  ).toEqual([
    {
      Referencia: "NM-001",
      Nombre: "Pastillas de freno ceramic",
      "Cantidad a solicitar": 9,
    },
  ]);
  await expect(page.getByText("Excel descargado")).toBeVisible();
});
