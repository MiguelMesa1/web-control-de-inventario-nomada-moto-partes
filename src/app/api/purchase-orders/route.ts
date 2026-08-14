import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest } from "@/lib/security/request";
import type { PurchaseOrderStatus } from "@/types/inventory";

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

function errorMessage(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "No pudimos guardar los pedidos.";
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

function isValidOrder(order: PurchaseOrderPayload) {
  if (!order.supplierName?.trim() || !order.items?.length) return false;
  return order.items.every((item) => {
    const quantity = Number(item.quantity);
    const minimumStock = Number(item.minimumStock);
    const maximumStock = Number(item.maximumStock);
    return (
      Boolean(item.sku?.trim()) &&
      Boolean(item.productName?.trim()) &&
      Number.isInteger(quantity) &&
      quantity >= 1 &&
      quantity <= 999999 &&
      Number.isFinite(minimumStock) &&
      Number.isFinite(maximumStock) &&
      minimumStock >= 0 &&
      maximumStock >= minimumStock
    );
  });
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const { response } = await requirePurchaseEditor();
  if (response) return response;

  const body = (await request.json()) as { orders?: PurchaseOrderPayload[] };
  const orders = body.orders;
  if (
    !Array.isArray(orders) ||
    orders.length < 1 ||
    orders.length > 20 ||
    !orders.every(isValidOrder)
  ) {
    return NextResponse.json(
      { message: "Revisa los proveedores, productos y cantidades del carrito." },
      { status: 400 },
    );
  }

  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc(
    "create_purchase_orders",
    { p_orders: orders },
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

  const body = (await request.json()) as {
    id?: string;
    status?: PurchaseOrderStatus;
  };
  const allowedStatuses: PurchaseOrderStatus[] = [
    "ordered",
    "received",
    "cancelled",
  ];
  if (!body.id || !body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { message: "El pedido o el nuevo estado no son válidos." },
      { status: 400 },
    );
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("purchase_orders")
    .update({ status: body.status, updated_by: profile.id })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json(
      { message: errorMessage(error) },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
