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
    : "No pudimos actualizar el Punto de Reorden.";
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
    reorderPoint?: number;
    notes?: string;
  };
  const sku = body.sku?.trim();
  const productName = body.productName?.trim();
  const reorderPoint = Number(body.reorderPoint ?? 10);

  if (!sku || !productName) {
    return NextResponse.json(
      { message: "La referencia y el nombre del producto son obligatorios." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(reorderPoint) || reorderPoint < 0 || reorderPoint > 999999) {
    return NextResponse.json(
      { message: "El punto de reorden debe estar entre 0 y 999.999." },
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
        reorder_point: reorderPoint,
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
          ? "Esta referencia ya está incluida en el Punto de Reorden."
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
    reorderPoint?: number;
    notes?: string;
    active?: boolean;
  };
  const reorderPoint = Number(body.reorderPoint);
  if (!body.id) {
    return NextResponse.json({ message: "Falta el identificador." }, { status: 400 });
  }
  if (!Number.isFinite(reorderPoint) || reorderPoint < 0 || reorderPoint > 999999) {
    return NextResponse.json(
      { message: "El punto de reorden debe estar entre 0 y 999.999." },
      { status: 400 },
    );
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("reorder_watchlist")
    .update({
      reorder_point: reorderPoint,
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
