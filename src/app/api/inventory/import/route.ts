import { NextResponse } from "next/server";
import { sendBrevoEmail } from "@/lib/email/brevo-smtp";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { isValidInventorySourceDate } from "@/lib/inventory/source-date";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { requireJsonRequest } from "@/lib/security/request";
import type { InventoryItem, ReorderLineSetting, ReorderWatchItem } from "@/types/inventory";

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" })[character] ?? character);

function reorderEmailHtml(
  rows: ReturnType<typeof buildReorderAlertRows>,
  context: { filename: string; uploaderName: string },
) {
  const suggestedUnits = rows.reduce((total, row) => total + row.deficit, 0);
  const items = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.productLine ?? "Sin línea")}</td><td>${escapeHtml(row.supplier ?? "Sin proveedor")}</td><td>${row.status === "exhausted" ? "Agotado" : "Por recompra"}</td><td align="right">${row.available}</td><td align="right">${row.reorderPoint}</td><td align="right"><strong>${row.deficit}</strong></td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1f2937"><h2 style="color:#e11d48">Stock bajo - Nomada Moto Partes</h2><p>Hola ${escapeHtml(context.uploaderName)}, después de publicar <strong>${escapeHtml(context.filename)}</strong> encontramos productos que requieren recompra.</p><p><strong>${rows.length}</strong> referencias por revisar · <strong>${suggestedUnits}</strong> unidades sugeridas para comprar.</p><table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px"><thead style="background:#f3f4f6"><tr><th>SKU</th><th>Producto</th><th>Línea</th><th>Proveedor</th><th>Estado</th><th>Disponible</th><th>Punto de reorden</th><th>Compra sugerida</th></tr></thead><tbody>${items}</tbody></table><p style="color:#6b7280;font-size:12px">Este aviso se generó automáticamente al publicar el inventario.</p></body></html>`;
}

function errorMessage(caught: unknown, fallback: string) {
  return (
    typeof caught === "object" &&
    caught !== null &&
    "message" in caught &&
    typeof caught.message === "string"
      ? caught.message
      : fallback
  );
}

async function processReorderNotifications(
  insforge: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  recipient: { email: string; displayName: string },
  filename: string,
  items: InventoryItem[],
) {
  let watchlist: ReorderWatchItem[];
  let lineSettings: ReorderLineSetting[];

  try {
    const [watchResult, lineResult] = await Promise.all([
      insforge.database
        .from("reorder_watchlist")
        .select(
          "id,source_id,sku,product_name,supplier,reorder_point,active,notes,created_at,updated_at",
        )
        .eq("active", true),
      insforge.database
        .from("reorder_line_settings")
        .select("product_line,reorder_point"),
    ]);
    if (watchResult.error || lineResult.error) {
      throw watchResult.error ?? lineResult.error;
    }

    watchlist = (watchResult.data ?? []).map((item) => ({
      id: String(item.id),
      sourceId: item.source_id == null ? undefined : Number(item.source_id),
      sku: String(item.sku),
      productName: String(item.product_name),
      supplier: item.supplier ?? undefined,
      reorderPoint: Number(item.reorder_point),
      active: Boolean(item.active),
      notes: item.notes ?? undefined,
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
    }));
    lineSettings = (lineResult.data ?? []).map((item) => ({
      productLine: String(item.product_line),
      reorderPoint: Number(item.reorder_point),
    }));
  } catch (caught) {
    return {
      reorderCount: 0,
      reorderWarning: errorMessage(
        caught,
        "No pudimos calcular las alertas de recompra.",
      ),
    };
  }

  const belowPoint = buildReorderAlertRows(
    watchlist,
    items,
    lineSettings,
  ).filter(
    (item) => item.status === "exhausted" || item.status === "reorder",
  );
  if (!belowPoint.length) return { reorderCount: 0 };

  try {
    await sendBrevoEmail({
      to: recipient.email,
      subject: `Stock bajo: ${belowPoint.length} referencias por revisar`,
      html: reorderEmailHtml(belowPoint, {
        filename,
        uploaderName: recipient.displayName,
      }),
    });
    return {
      reorderCount: belowPoint.length,
    };
  } catch (caught) {
    return {
      reorderCount: belowPoint.length,
      emailWarning: errorMessage(
        caught,
        "No pudimos enviar el correo de recompra.",
      ),
    };
  }
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request, 5_500_000);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json({ message: "No tienes permiso de carga." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      filename?: string;
      checksum?: string;
      sourceExportedAt?: string;
      items?: InventoryItem[];
    };
    if (!body.filename || !body.checksum || !body.sourceExportedAt || !body.items?.length) {
      return NextResponse.json({ message: "La carga está incompleta." }, { status: 400 });
    }
    if (!isValidInventorySourceDate(body.sourceExportedAt)) {
      return NextResponse.json({ message: "La fecha del archivo no es válida." }, { status: 400 });
    }
    if (body.items.length > 100_000) {
      return NextResponse.json({ message: "La carga supera 100.000 filas." }, { status: 413 });
    }

    const insforge = await createInsForgeServerClient();
    const payload = body.items.map((item) => ({
      sku: item.sku,
      product_name: item.productName,
      product_line: item.productLine,
      warehouse: item.warehouse,
      stock: item.stock,
      reserved: item.reserved,
      available: item.available,
    }));
    const { data, error } = await insforge.database.rpc(
      "publish_inventory_snapshot",
      {
        items: payload,
        upload_filename: body.filename,
        upload_checksum: body.checksum,
        exported_at: body.sourceExportedAt,
      },
    );
    if (error) throw error;

    const reorderResult = await processReorderNotifications(
      insforge,
      { email: profile.email, displayName: profile.displayName },
      body.filename,
      body.items,
    ).catch((caught) => ({
      reorderCount: 0,
      reorderWarning: errorMessage(
        caught,
        "No pudimos calcular las alertas de recompra.",
      ),
    }));
    return NextResponse.json({ data, ...reorderResult });
  } catch (caught) {
    return NextResponse.json(
      {
        message: errorMessage(
          caught,
          "No pudimos publicar el archivo. Revisa el detalle e intenta nuevamente.",
        ),
      },
      { status: 400 },
    );
  }
}
