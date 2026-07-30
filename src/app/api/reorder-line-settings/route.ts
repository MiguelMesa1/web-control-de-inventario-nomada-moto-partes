import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest, requireSameOrigin } from "@/lib/security/request";

export async function PUT(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin") {
    return NextResponse.json({ message: "Solo un administrador puede modificar las reglas por línea." }, { status: 403 });
  }

  const body = (await request.json()) as { productLine?: string; reorderPoint?: number };
  const productLine = body.productLine?.trim();
  const reorderPoint = Number(body.reorderPoint);
  if (!productLine || !Number.isFinite(reorderPoint) || reorderPoint < 0 || reorderPoint > 999999) {
    return NextResponse.json({ message: "Indica una línea y un punto entre 0 y 999.999." }, { status: 400 });
  }

  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("reorder_line_settings").upsert(
    [{ product_line: productLine, reorder_point: reorderPoint, updated_by: profile.id }],
    { onConflict: "product_line" },
  );
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const requestError = requireSameOrigin(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin") return NextResponse.json({ message: "Solo un administrador puede modificar las reglas por línea." }, { status: 403 });
  const productLine = new URL(request.url).searchParams.get("productLine")?.trim();
  if (!productLine) return NextResponse.json({ message: "Falta la línea." }, { status: 400 });
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("reorder_line_settings").delete().eq("product_line", productLine);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
