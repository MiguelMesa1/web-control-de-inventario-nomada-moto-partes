import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest, requireSameOrigin } from "@/lib/security/request";

type KitPartInput = {
  sku?: string;
  productName?: string;
  quantityRequired?: number;
};

type KitInput = {
  id?: string;
  name?: string;
  brand?: string;
  color?: string;
  hasHeadlight?: boolean;
  model?: string;
  warehouse?: string;
  active?: boolean;
  parts?: KitPartInput[];
};

function messageFrom(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "No pudimos guardar el kit plástico.";
  if (/administrator|admin/i.test(message)) {
    return "Solo un administrador puede modificar los kits plásticos.";
  }
  if (/same part|unique|duplicate/i.test(message)) {
    return "Una pieza no puede aparecer dos veces en el mismo kit.";
  }
  if (/at least two parts/i.test(message)) {
    return "Agrega al menos dos piezas para crear el kit.";
  }
  return message;
}

async function requireAdmin() {
  const profile = await getAppProfile();
  if (profile.role !== "admin") {
    return NextResponse.json(
      { message: "Solo un administrador puede modificar los kits plásticos." },
      { status: 403 },
    );
  }
  return null;
}

function validateKit(body: KitInput) {
  const name = body.name?.trim();
  const brand = body.brand?.trim();
  const color = body.color?.trim();
  const warehouse = body.warehouse?.trim();
  const parts = Array.isArray(body.parts) ? body.parts : [];

  if (!name || !brand || !color || !warehouse) {
    return "Completa nombre, marca, color y bodega.";
  }
  if (typeof body.hasHeadlight !== "boolean") {
    return "Selecciona si el kit es con farola o sin farola.";
  }
  if ([name, brand, color, warehouse, body.model ?? ""].some((value) => value.length > 120)) {
    return "Los datos del kit no pueden superar 120 caracteres.";
  }
  if (parts.length < 2 || parts.length > 100) {
    return "Cada kit debe tener entre 2 y 100 piezas.";
  }
  const normalizedSkus = new Set<string>();
  for (const part of parts) {
    const sku = part.sku?.trim();
    const productName = part.productName?.trim();
    const quantity = Number(part.quantityRequired);
    if (!sku || !productName || sku.length > 120 || productName.length > 300) {
      return "Todas las piezas deben tener una referencia y un nombre válidos.";
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return "La cantidad de cada pieza debe estar entre 1 y 999.";
    }
    const normalizedSku = sku.toLocaleLowerCase("es");
    if (normalizedSkus.has(normalizedSku)) {
      return "Una pieza no puede aparecer dos veces en el mismo kit.";
    }
    normalizedSkus.add(normalizedSku);
  }
  return null;
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = (await request.json()) as KitInput;
  const validationError = validateKit(body);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc("save_plastic_kit", {
    p_id: body.id ?? null,
    p_name: body.name!.trim(),
    p_brand: body.brand!.trim(),
    p_color: body.color!.trim(),
    p_has_headlight: body.hasHeadlight,
    p_model: body.model?.trim() || null,
    p_warehouse: body.warehouse!.trim(),
    p_active: body.active ?? true,
    p_parts: body.parts!.map((part) => ({
      sku: part.sku!.trim(),
      productName: part.productName!.trim(),
      quantityRequired: Number(part.quantityRequired),
    })),
  });

  if (error) {
    return NextResponse.json({ message: messageFrom(error) }, { status: 400 });
  }
  return NextResponse.json({ id: String(data) }, { status: body.id ? 200 : 201 });
}

export async function DELETE(request: Request) {
  const requestError = requireSameOrigin(request);
  if (requestError) return requestError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Falta el identificador del kit." }, { status: 400 });
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.rpc("delete_plastic_kit", { p_id: id });
  if (error) {
    return NextResponse.json({ message: messageFrom(error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
