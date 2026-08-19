import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest, requireSameOrigin } from "@/lib/security/request";
import {
  isBoolean,
  parseFiniteNumber,
  readJsonObject,
  sanitizeOptionalText,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/security/input";

function errorMessage(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "No pudimos actualizar la configuración de recompra.";
}

async function requireAdmin() {
  const profile = await getAppProfile();
  if (profile.role !== "admin") {
    return {
      profile,
      response: NextResponse.json(
        { message: "Solo un administrador puede modificar esta lista." },
        { status: 403 },
      ),
    };
  }
  return { profile, response: null };
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const sku = sanitizeText(body.sku, { maxLength: 120 });
  const productName = sanitizeText(body.productName, { maxLength: 300 });
  const primarySupplier = sanitizeText(body.primarySupplier, { maxLength: 180 });
  const secondarySupplier = sanitizeOptionalText(body.secondarySupplier, { maxLength: 180 });
  const notes = sanitizeOptionalText(body.notes, { maxLength: 2000, multiline: true });
  const sourceId = body.sourceId == null ? null : parseFiniteNumber(body.sourceId, { integer: true, min: 1, max: 2_147_483_647 });
  const minimumStock = parseFiniteNumber(body.minimumStock ?? 10, { min: 0, max: 999999 });
  const maximumStock = parseFiniteNumber(body.maximumStock ?? 20, { min: 0, max: 999999 });

  if (!sku || !productName) {
    return NextResponse.json(
      { message: "La referencia y el nombre del producto son obligatorios." },
      { status: 400 },
    );
  }
  if (!primarySupplier) {
    return NextResponse.json(
      { message: "El proveedor principal es obligatorio." },
      { status: 400 },
    );
  }
  if (
    minimumStock === null ||
    maximumStock === null ||
    maximumStock < minimumStock ||
    (body.sourceId != null && sourceId === null) ||
    (body.secondarySupplier != null && body.secondarySupplier !== "" && secondarySupplier === null) ||
    (body.notes != null && body.notes !== "" && notes === null)
  ) {
    return NextResponse.json(
      { message: "El máximo debe ser igual o mayor al mínimo." },
      { status: 400 },
    );
  }

  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database
    .from("reorder_watchlist")
    .insert([
      {
        source_id: sourceId,
        sku,
        product_name: productName,
        primary_supplier: primarySupplier,
        secondary_supplier: secondarySupplier,
        minimum_stock: minimumStock,
        maximum_stock: maximumStock,
        supplier: primarySupplier,
        reorder_point: minimumStock,
        notes,
        created_by: profile.id,
        updated_by: profile.id,
      },
    ])
    .select("id");

  if (error) {
    const message = errorMessage(error);
    return NextResponse.json(
      {
        message: /unique|duplicate/i.test(message)
          ? "Esta referencia ya está incluida en Recompra."
          : message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: data?.[0]?.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const id = sanitizeUuid(body.id);
  const primarySupplier = sanitizeText(body.primarySupplier, { maxLength: 180 });
  const secondarySupplier = sanitizeOptionalText(body.secondarySupplier, { maxLength: 180 });
  const notes = sanitizeOptionalText(body.notes, { maxLength: 2000, multiline: true });
  const minimumStock = parseFiniteNumber(body.minimumStock, { min: 0, max: 999999 });
  const maximumStock = parseFiniteNumber(body.maximumStock, { min: 0, max: 999999 });
  if (!id) {
    return NextResponse.json({ message: "Falta el identificador." }, { status: 400 });
  }
  if (!primarySupplier) {
    return NextResponse.json(
      { message: "El proveedor principal es obligatorio." },
      { status: 400 },
    );
  }
  if (
    minimumStock === null ||
    maximumStock === null ||
    maximumStock < minimumStock ||
    (body.secondarySupplier != null && body.secondarySupplier !== "" && secondarySupplier === null) ||
    (body.notes != null && body.notes !== "" && notes === null) ||
    (body.active != null && !isBoolean(body.active))
  ) {
    return NextResponse.json(
      { message: "El máximo debe ser igual o mayor al mínimo." },
      { status: 400 },
    );
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("reorder_watchlist")
    .update({
      primary_supplier: primarySupplier,
      secondary_supplier: secondarySupplier,
      minimum_stock: minimumStock,
      maximum_stock: maximumStock,
      supplier: primarySupplier,
      reorder_point: minimumStock,
      notes,
      active: isBoolean(body.active) ? body.active : true,
      updated_by: profile.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: errorMessage(error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const requestError = requireSameOrigin(request);
  if (requestError) return requestError;
  const { response } = await requireAdmin();
  if (response) return response;

  const id = sanitizeUuid(new URL(request.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ message: "Falta el identificador." }, { status: 400 });
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("reorder_watchlist")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: errorMessage(error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
