import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { loadPurchaseOrderHistoryPage } from "@/lib/inventory/data";
import { loadActiveOrderSkus } from "@/lib/orders/active-order-data";
import { requireJsonRequest } from "@/lib/security/request";
import type { PurchaseOrderStatus } from "@/types/inventory";
import {
  isPlainObject,
  parseFiniteNumber,
  readJsonObject,
  sanitizeOptionalText,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/security/input";

type PurchaseOrderPayload = {
  supplierName?: string;
  notes?: string;
  items?: Array<{
    sku?: string;
    productName?: string;
    quantity?: number;
    available?: number;
    minimumStock?: number;
    maximumStock?: number;
  }>;
};

function errorMessage(
  error: unknown,
  fallback = "No pudimos guardar los pedidos.",
) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : fallback;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const offsetValue = searchParams.get("offset") ?? "0";
  const snapshotBeforeValue = searchParams.get("before");
  const offset = Number(offsetValue);
  const snapshotBefore = snapshotBeforeValue
    ? new Date(snapshotBeforeValue)
    : new Date();
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1_000_000 ||
    Number.isNaN(snapshotBefore.getTime())
  ) {
    return NextResponse.json(
      { message: "La página de pedidos solicitada no es válida." },
      { status: 400 },
    );
  }

  try {
    const result = await loadPurchaseOrderHistoryPage(
      offset,
      30,
      snapshotBefore.toISOString(),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: errorMessage(
          error,
          "No pudimos cargar los pedidos anteriores.",
        ),
      },
      { status: 400 },
    );
  }
}

async function requirePurchaseEditor() {
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return {
      profile,
      response: NextResponse.json(
        { message: "No tienes permiso para gestionar pedidos." },
        { status: 403 },
      ),
    };
  }
  return { profile, response: null };
}

function normalizeOrder(value: unknown): PurchaseOrderPayload | null {
  if (!isPlainObject(value)) return null;
  const supplierName = sanitizeText(value.supplierName, { maxLength: 180 });
  const notes = sanitizeOptionalText(value.notes, { maxLength: 2000, multiline: true });
  if (!supplierName || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 500) return null;
  if (value.notes != null && value.notes !== "" && notes === null) return null;

  const items = value.items.map((item) => {
    if (!isPlainObject(item)) return null;
    const sku = sanitizeText(item.sku, { maxLength: 120 });
    const productName = sanitizeText(item.productName, { maxLength: 300 });
    const quantity = parseFiniteNumber(item.quantity, { integer: true, min: 1, max: 999999 });
    const available = parseFiniteNumber(item.available, { min: -999999, max: 999999 });
    const minimumStock = parseFiniteNumber(item.minimumStock, { min: 0, max: 999999 });
    const maximumStock = parseFiniteNumber(item.maximumStock, { min: 0, max: 999999 });
    if (!sku || !productName || quantity === null || available === null || minimumStock === null || maximumStock === null || maximumStock < minimumStock) return null;
    return { sku, productName, quantity, available, minimumStock, maximumStock };
  });
  if (items.some((item) => item === null)) return null;
  return { supplierName, notes: notes ?? undefined, items: items as NonNullable<PurchaseOrderPayload["items"]> };
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const { response } = await requirePurchaseEditor();
  if (response) return response;

  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const rawOrders = parsed.data.orders;
  const orders = Array.isArray(rawOrders) ? rawOrders.map(normalizeOrder) : [];
  if (
    orders.length < 1 ||
    orders.length > 20 ||
    orders.some((order) => order === null) ||
    orders.reduce((total, order) => total + (order?.items?.length ?? 0), 0) > 2000
  ) {
    return NextResponse.json(
      { message: "Revisa los proveedores, productos y cantidades del carrito." },
      { status: 400 },
    );
  }
  const cleanOrders = orders as PurchaseOrderPayload[];

  const insforge = await createInsForgeServerClient();
  const requestedSkus = [
    ...new Set(
      cleanOrders.flatMap((order) =>
        (order.items ?? []).map((item) => item.sku!.trim()),
      ),
    ),
  ];
  try {
    const activeOrderSkus = new Set(await loadActiveOrderSkus(insforge));
    const references = requestedSkus.filter((sku) => activeOrderSkus.has(sku));
    if (references.length) {
      return NextResponse.json(
        {
          message: `Ya existe un pedido pendiente para ${references.length === 1 ? "la referencia" : "las referencias"} ${references.join(", ")}. Confirma que llegó o cancela el pedido antes de volver a ${references.length === 1 ? "solicitarla" : "solicitarlas"}.`,
        },
        { status: 409 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 400 },
    );
  }

  const { data, error } = await insforge.database.rpc(
    "create_purchase_orders",
    { p_orders: cleanOrders },
  );
  if (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 400 },
    );
  }

  return NextResponse.json({ orders: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const { profile, response } = await requirePurchaseEditor();
  if (response) return response;

  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const id = sanitizeUuid(parsed.data.id);
  const status = parsed.data.status;
  const allowedStatuses: PurchaseOrderStatus[] = [
    "ordered",
    "received",
    "cancelled",
  ];
  if (!id || typeof status !== "string" || !allowedStatuses.includes(status as PurchaseOrderStatus)) {
    return NextResponse.json(
      { message: "El pedido o el nuevo estado no son válidos." },
      { status: 400 },
    );
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("purchase_orders")
    .update({ status, updated_by: profile.id })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
