import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest } from "@/lib/security/request";

export async function PATCH(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin") {
    return NextResponse.json({ message: "Solo un administrador puede cambiar esta regla." }, { status: 403 });
  }
  const body = (await request.json()) as { lowStockThreshold?: number };
  const threshold = Number(body.lowStockThreshold);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 9999) {
    return NextResponse.json({ message: "El umbral debe estar entre 0 y 9.999." }, { status: 400 });
  }
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("inventory_settings")
    .update({ low_stock_threshold: threshold, updated_by: profile.id })
    .eq("id", true);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await insforge.database.from("audit_events").insert([
    {
      actor_id: profile.id,
      action: "settings.updated",
      entity_type: "inventory_settings",
      entity_id: "global",
      details: { low_stock_threshold: threshold },
    },
  ]);
  return NextResponse.json({ ok: true });
}
