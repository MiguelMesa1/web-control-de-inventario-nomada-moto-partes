import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { normalizePlasticKitHeadlight } from "@/lib/inventory/plastic-kit-headlight";
import { requireJsonRequest, requireSameOrigin } from "@/lib/security/request";
import {
  isBoolean,
  isPlainObject,
  parseFiniteNumber,
  readJsonObject,
  sanitizeOptionalText,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/security/input";

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
  if (/at least (?:one|two) parts/i.test(message)) {
    return "Agrega al menos una pieza para crear el kit.";
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

function validateKit(raw: Record<string, unknown>) {
  const id = raw.id == null ? null : sanitizeUuid(raw.id);
  const name = sanitizeText(raw.name, { maxLength: 120 });
  const brand = sanitizeText(raw.brand, { maxLength: 120 });
  const color = sanitizeText(raw.color, { maxLength: 120 });
  const model = sanitizeOptionalText(raw.model, { maxLength: 120 });
  const warehouse = sanitizeText(raw.warehouse, { maxLength: 120 });
  const parts = Array.isArray(raw.parts) ? raw.parts : [];

  if (!name || !brand || !color || !warehouse) {
    return { error: "Completa nombre, marca, color y bodega." };
  }
  if ((raw.id != null && !id) || (raw.model != null && raw.model !== "" && !model)) {
    return { error: "Los datos del kit no son válidos." };
  }
  if (raw.hasHeadlight !== null && !isBoolean(raw.hasHeadlight)) {
    return { error: "Indica si el kit maneja farola y selecciona su presentación." };
  }
  if (raw.active != null && !isBoolean(raw.active)) {
    return { error: "El estado del kit no es válido." };
  }
  if (parts.length < 1 || parts.length > 100) {
    return { error: "Cada kit debe tener entre 1 y 100 piezas." };
  }
  const normalizedSkus = new Set<string>();
  const cleanParts: Array<{ sku: string; productName: string; quantityRequired: number }> = [];
  for (const part of parts) {
    if (!isPlainObject(part)) {
      return { error: "Todas las piezas deben tener una referencia y un nombre válidos." };
    }
    const sku = sanitizeText(part.sku, { maxLength: 120 });
    const productName = sanitizeText(part.productName, { maxLength: 300 });
    const quantity = parseFiniteNumber(part.quantityRequired, { integer: true, min: 1, max: 999 });
    if (!sku || !productName) {
      return { error: "Todas las piezas deben tener una referencia y un nombre válidos." };
    }
    if (quantity === null) {
      return { error: "La cantidad de cada pieza debe estar entre 1 y 999." };
    }
    const normalizedSku = sku.toLocaleLowerCase("es");
    if (normalizedSkus.has(normalizedSku)) {
      return { error: "Una pieza no puede aparecer dos veces en el mismo kit." };
    }
    normalizedSkus.add(normalizedSku);
    cleanParts.push({ sku, productName, quantityRequired: quantity });
  }
  return {
    error: null,
    value: {
      id,
      name,
      brand,
      color,
      hasHeadlight: raw.hasHeadlight as boolean | null,
      model,
      warehouse,
      active: isBoolean(raw.active) ? raw.active : true,
      parts: cleanParts,
    },
  };
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const authError = await requireAdmin();
  if (authError) return authError;

  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const validation = validateKit(parsed.data);
  if (validation.error || !validation.value) {
    return NextResponse.json({ message: validation.error }, { status: 400 });
  }
  const body = validation.value;

  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc("save_plastic_kit", {
    p_id: body.id,
    p_name: body.name,
    p_brand: body.brand,
    p_color: body.color,
    p_has_headlight: normalizePlasticKitHeadlight(
      body.model || body.brand,
      body.hasHeadlight,
    ),
    p_model: body.model,
    p_warehouse: body.warehouse,
    p_active: body.active,
    p_parts: body.parts,
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

  const id = sanitizeUuid(new URL(request.url).searchParams.get("id"));
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
