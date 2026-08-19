import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest, requireSameOrigin } from "@/lib/security/request";
import { parseFiniteNumber, readJsonObject, sanitizeText } from "@/lib/security/input";

export async function PUT(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin") {
    return NextResponse.json({ message: "Solo un administrador puede modificar las reglas por línea." }, { status: 403 });
  }

  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const productLine = sanitizeText(parsed.data.productLine, { maxLength: 120 });
  const reorderPoint = parseFiniteNumber(parsed.data.reorderPoint, { min: 0, max: 999999 });
  if (!productLine || reorderPoint === null) {
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
  const productLine = sanitizeText(new URL(request.url).searchParams.get("productLine"), { maxLength: 120 });
  if (!productLine) return NextResponse.json({ message: "Falta la línea." }, { status: 400 });
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("reorder_line_settings").delete().eq("product_line", productLine);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
