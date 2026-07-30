import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { isValidInventorySourceDate } from "@/lib/inventory/source-date";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import type { InventoryItem, ReorderLineSetting, ReorderWatchItem } from "@/types/inventory";

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" })[character] ?? character);

function reorderEmailHtml(rows: ReturnType<typeof buildReorderAlertRows>) {
  const items = rows.map((row) => `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.productLine ?? "Sin línea")}</td><td align="right">${row.available}</td><td align="right">${row.reorderPoint}</td></tr>`).join("");
  return `<h2>Productos Por Agotarse Nomada Moto Partes</h2><p>Después de tu subida, los productos de reorden que tienen menos unidades de las necesarias en bodega son:</p><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>SKU</th><th>Producto</th><th>Línea</th><th>Disponible</th><th>Punto de reorden</th></tr></thead><tbody>${items}</tbody></table>`;
}
import { requireJsonRequest } from "@/lib/security/request";

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

    const [watchResult, lineResult] = await Promise.all([
      insforge.database.from("reorder_watchlist").select("id,source_id,sku,product_name,supplier,reorder_point,active,notes,created_at,updated_at").eq("active", true),
      insforge.database.from("reorder_line_settings").select("product_line,reorder_point"),
    ]);
    if (watchResult.error || lineResult.error) throw watchResult.error ?? lineResult.error;
    const watchlist: ReorderWatchItem[] = (watchResult.data ?? []).map((item) => ({
      id: String(item.id), sourceId: item.source_id == null ? undefined : Number(item.source_id), sku: String(item.sku), productName: String(item.product_name), supplier: item.supplier ?? undefined, reorderPoint: Number(item.reorder_point), active: Boolean(item.active), notes: item.notes ?? undefined, createdAt: String(item.created_at), updatedAt: String(item.updated_at),
    }));
    const lineSettings: ReorderLineSetting[] = (lineResult.data ?? []).map((item) => ({ productLine: String(item.product_line), reorderPoint: Number(item.reorder_point) }));
    const belowPoint = buildReorderAlertRows(watchlist, body.items, lineSettings).filter((item) => item.hasInventoryRecord && item.available < item.reorderPoint);
    let emailWarning: string | undefined;
    if (belowPoint.length) {
      const { error: emailError } = await insforge.emails.send({
        to: profile.email,
        subject: "Productos Por Agotarse Nomada Moto Partes",
        html: reorderEmailHtml(belowPoint),
        from: "Nomada Moto Partes",
      });
      if (emailError) emailWarning = emailError.message;
    }
    return NextResponse.json({ data, reorderCount: belowPoint.length, emailWarning });
  } catch (caught) {
    const backendMessage =
      typeof caught === "object" &&
      caught !== null &&
      "message" in caught &&
      typeof caught.message === "string"
        ? caught.message
        : null;

    return NextResponse.json(
      {
        message:
          backendMessage ??
          "No pudimos publicar el archivo. Revisa el detalle e intenta nuevamente.",
      },
      { status: 400 },
    );
  }
}
