import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest, requireSameOrigin } from "@/lib/security/request";

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

  const body = (await request.json()) as {
    sourceId?: number;
    sku?: string;
    productName?: string;
    primarySupplier?: string;
    secondarySupplier?: string;
    minimumStock?: number;
    maximumStock?: number;
    notes?: string;
  };
  const sku = body.sku?.trim();
  const productName = body.productName?.trim();
  const primarySupplier = body.primarySupplier?.trim();
  const minimumStock = Number(body.minimumStock ?? 10);
  const maximumStock = Number(body.maximumStock ?? 20);

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
    !Number.isFinite(minimumStock) ||
    !Number.isFinite(maximumStock) ||
    minimumStock < 0 ||
    maximumStock < minimumStock ||
    maximumStock > 999999
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
        source_id: body.sourceId || null,
        sku,
        product_name: productName,
        primary_supplier: primarySupplier,
        secondary_supplier: body.secondarySupplier?.trim() || null,
        minimum_stock: minimumStock,
        maximum_stock: maximumStock,
        supplier: primarySupplier,
        reorder_point: minimumStock,
        notes: body.notes?.trim() || null,
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

  const body = (await request.json()) as {
    id?: string;
    primarySupplier?: string;
    secondarySupplier?: string;
    minimumStock?: number;
    maximumStock?: number;
    notes?: string;
    active?: boolean;
  };
  const primarySupplier = body.primarySupplier?.trim();
  const minimumStock = Number(body.minimumStock);
  const maximumStock = Number(body.maximumStock);
  if (!body.id) {
    return NextResponse.json({ message: "Falta el identificador." }, { status: 400 });
  }
  if (!primarySupplier) {
    return NextResponse.json(
      { message: "El proveedor principal es obligatorio." },
      { status: 400 },
    );
  }
  if (
    !Number.isFinite(minimumStock) ||
    !Number.isFinite(maximumStock) ||
    minimumStock < 0 ||
    maximumStock < minimumStock ||
    maximumStock > 999999
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
      secondary_supplier: body.secondarySupplier?.trim() || null,
      minimum_stock: minimumStock,
      maximum_stock: maximumStock,
      supplier: primarySupplier,
      reorder_point: minimumStock,
      notes: body.notes?.trim() || null,
      active: body.active ?? true,
      updated_by: profile.id,
    })
    .eq("id", body.id);

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

  const id = new URL(request.url).searchParams.get("id");
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
