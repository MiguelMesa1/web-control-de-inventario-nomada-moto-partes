import { NextResponse } from "next/server";
import { sendBrevoEmail } from "@/lib/email/brevo-smtp";
import { recordEmailDeliveryAttempt } from "@/lib/email/delivery-attempts";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { isValidInventorySourceDate } from "@/lib/inventory/source-date";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { loadActiveOrderSkus } from "@/lib/orders/active-order-data";
import { excludeActiveOrderRows } from "@/lib/orders/active-orders";
import { requireJsonRequest } from "@/lib/security/request";
import {
  isPlainObject,
  parseFiniteNumber,
  readJsonObject,
  sanitizeText,
} from "@/lib/security/input";
import type {
  InventoryItem,
  ReorderStatus,
  ReorderWatchItem,
} from "@/types/inventory";

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" })[character] ?? character);

export function reorderEmailStatusLabel(status: ReorderStatus) {
  if (status === "missing") return "Sin registro";
  if (status === "exhausted") return "Agotado";
  if (status === "low") return "Por reponer";
  return "Nivel estable";
}

function reorderEmailHtml(
  rows: ReturnType<typeof buildReorderAlertRows>,
  context: { filename: string; uploaderName: string },
) {
  const suggestedUnits = rows.reduce(
    (total, row) => total + row.suggestedQuantity,
    0,
  );
  const items = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.productName)}</td><td>${escapeHtml(row.productLine ?? "Sin línea")}</td><td>${escapeHtml(row.primarySupplier ?? "Sin proveedor")}</td><td>${reorderEmailStatusLabel(row.status)}</td><td align="right">${row.hasInventoryRecord ? row.available : "—"}</td><td align="right">${row.minimumStock}</td><td align="right">${row.maximumStock}</td><td align="right"><strong>${row.suggestedQuantity}</strong></td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1f2937"><h2 style="color:#e11d48">Inventario bajo - Nomada Moto Partes</h2><p>Hola ${escapeHtml(context.uploaderName)}, después de publicar <strong>${escapeHtml(context.filename)}</strong> encontramos productos que llegaron a su mínimo.</p><p><strong>${rows.length}</strong> referencias por revisar · <strong>${suggestedUnits}</strong> unidades sugeridas para completar los máximos.</p><table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px"><thead style="background:#f3f4f6"><tr><th>SKU</th><th>Producto</th><th>Línea</th><th>Proveedor principal</th><th>Estado</th><th>Disponible</th><th>Mínimo</th><th>Máximo</th><th>Compra sugerida</th></tr></thead><tbody>${items}</tbody></table><p style="color:#6b7280;font-size:12px">Este aviso se generó automáticamente al publicar el inventario.</p></body></html>`;
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

function optionalErrorProperty(caught: unknown, property: string) {
  if (
    typeof caught !== "object" ||
    caught === null ||
    !(property in caught)
  ) {
    return undefined;
  }
  const value = (caught as Record<string, unknown>)[property];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

async function recordEmailAttemptSafely(
  attempt: Parameters<typeof recordEmailDeliveryAttempt>[0],
) {
  try {
    await recordEmailDeliveryAttempt(attempt);
    return undefined;
  } catch (caught) {
    return errorMessage(
      caught,
      "No pudimos guardar el intento de correo en el historial.",
    );
  }
}

async function processReorderNotifications(
  insforge: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  recipient: { id: string; email: string; displayName: string },
  snapshotId: string,
  filename: string,
  items: InventoryItem[],
) {
  let watchlist: ReorderWatchItem[];
  let activeOrderSkus: string[];
  try {
    const [watchResult, loadedActiveOrderSkus] = await Promise.all([
      insforge.database
        .from("reorder_watchlist")
        .select(
          "id,source_id,sku,product_name,primary_supplier,secondary_supplier,minimum_stock,maximum_stock,active,notes,created_at,updated_at",
        )
        .eq("active", true),
      loadActiveOrderSkus(insforge),
    ]);
    if (watchResult.error) throw watchResult.error;
    activeOrderSkus = loadedActiveOrderSkus;

    watchlist = (watchResult.data ?? []).map((item) => ({
      id: String(item.id),
      sourceId: item.source_id == null ? undefined : Number(item.source_id),
      sku: String(item.sku),
      productName: String(item.product_name),
      primarySupplier: item.primary_supplier ?? undefined,
      secondarySupplier: item.secondary_supplier ?? undefined,
      minimumStock: Number(item.minimum_stock),
      maximumStock: Number(item.maximum_stock),
      active: Boolean(item.active),
      notes: item.notes ?? undefined,
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
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

  const belowMinimum = excludeActiveOrderRows(
    buildReorderAlertRows(watchlist, items).filter(
      (item) =>
        item.status === "missing" ||
        item.status === "exhausted" ||
        item.status === "low",
    ),
    activeOrderSkus,
  );
  if (!belowMinimum.length) return { reorderCount: 0 };

  const subject = `Reposición requerida: ${belowMinimum.length} ${belowMinimum.length === 1 ? "referencia" : "referencias"} por revisar`;
  const suggestedUnits = belowMinimum.reduce(
    (total, row) => total + row.suggestedQuantity,
    0,
  );
  const startedAt = Date.now();
  const baseAttempt = {
    attemptedBy: recipient.id,
    snapshotId,
    filename,
    senderEmail: process.env.BREVO_FROM_EMAIL?.trim() || "No configurado",
    recipientEmail: recipient.email,
    recipientName: recipient.displayName,
    subject,
    alertCount: belowMinimum.length,
    suggestedUnits,
  };

  try {
    const receipt = await sendBrevoEmail({
      to: recipient.email,
      subject,
      html: reorderEmailHtml(belowMinimum, {
        filename,
        uploaderName: recipient.displayName,
      }),
    });
    const emailLogWarning = await recordEmailAttemptSafely({
      ...baseAttempt,
      status: "sent",
      durationMs: Date.now() - startedAt,
      providerMessageId: receipt.messageId,
      providerResponse: receipt.response,
    });
    return {
      reorderCount: belowMinimum.length,
      emailRecipient: recipient.email,
      emailLogWarning,
    };
  } catch (caught) {
    const emailLogWarning = await recordEmailAttemptSafely({
      ...baseAttempt,
      status: "failed",
      durationMs: Date.now() - startedAt,
      providerResponse: optionalErrorProperty(caught, "response"),
      errorCode: optionalErrorProperty(caught, "code"),
      errorMessage: errorMessage(
        caught,
        "No pudimos enviar el correo de recompra.",
      ),
    });
    return {
      reorderCount: belowMinimum.length,
      emailRecipient: recipient.email,
      emailWarning: errorMessage(
        caught,
        "No pudimos enviar el correo de recompra.",
      ),
      emailLogWarning,
    };
  }
}

function normalizeInventoryItem(value: unknown, sourceExportedAt: string): InventoryItem | null {
  if (!isPlainObject(value)) return null;
  const sku = sanitizeText(value.sku, { maxLength: 120 });
  const productName = sanitizeText(value.productName, { maxLength: 300 });
  const productLine = sanitizeText(value.productLine, { maxLength: 120 });
  const warehouse = sanitizeText(value.warehouse, { maxLength: 120 });
  const stock = parseFiniteNumber(value.stock, { min: -999_999_999, max: 999_999_999 });
  const reserved = parseFiniteNumber(value.reserved, { min: -999_999_999, max: 999_999_999 });
  const available = parseFiniteNumber(value.available, { min: -999_999_999, max: 999_999_999 });
  if (!sku || !productName || !productLine || !warehouse || stock === null || reserved === null || available === null) return null;
  return { sku, productName, productLine, warehouse, stock, reserved, available, sourceExportedAt };
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request, 5_500_000);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json({ message: "No tienes permiso de carga." }, { status: 403 });
  }

  try {
    const parsed = await readJsonObject(request);
    if (parsed.error) return parsed.error;
    const filename = sanitizeText(parsed.data.filename, { maxLength: 255 });
    const checksum = sanitizeText(parsed.data.checksum, { maxLength: 128 });
    const sourceExportedAt = sanitizeText(parsed.data.sourceExportedAt, { maxLength: 40 });
    const rawItems = parsed.data.items;
    if (!filename || !checksum || !sourceExportedAt || !Array.isArray(rawItems) || !rawItems.length) {
      return NextResponse.json({ message: "La carga está incompleta." }, { status: 400 });
    }
    if (!/^[a-f0-9]{64}$/i.test(checksum) || !isValidInventorySourceDate(sourceExportedAt)) {
      return NextResponse.json({ message: "La fecha del archivo no es válida." }, { status: 400 });
    }
    if (rawItems.length > 100_000) {
      return NextResponse.json({ message: "La carga supera 100.000 filas." }, { status: 413 });
    }
    const items = rawItems.map((item) => normalizeInventoryItem(item, sourceExportedAt));
    if (items.some((item) => item === null)) {
      return NextResponse.json({ message: "La carga contiene filas o valores no válidos." }, { status: 400 });
    }
    const cleanItems = items as InventoryItem[];

    const insforge = await createInsForgeServerClient();
    const payload = cleanItems.map((item) => ({
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
        upload_filename: filename,
        upload_checksum: checksum,
        exported_at: sourceExportedAt,
      },
    );
    if (error) throw error;

    const reorderResult = await processReorderNotifications(
      insforge,
      {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
      },
      String(data),
      filename,
      cleanItems,
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
