import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest } from "@/lib/security/request";
import { parseFiniteNumber, readJsonObject } from "@/lib/security/input";
import { recordAuditEvent } from "@/lib/security/audit";

export async function PATCH(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin") {
    return NextResponse.json({ message: "Solo un administrador puede cambiar esta regla." }, { status: 403 });
  }
  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const threshold = parseFiniteNumber(parsed.data.lowStockThreshold, { integer: true, min: 0, max: 9999 });
  if (threshold === null) {
    return NextResponse.json({ message: "El umbral debe estar entre 0 y 9.999." }, { status: 400 });
  }
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database
    .from("inventory_settings")
    .update({ low_stock_threshold: threshold, updated_by: profile.id })
    .eq("id", true);
  if (error) return NextResponse.json({ message: "No pudimos guardar la regla." }, { status: 400 });
  await recordAuditEvent({
    actorId: profile.id,
    action: "settings.updated",
    entityType: "inventory_settings",
    entityId: "global",
    details: { low_stock_threshold: threshold },
  });
  return NextResponse.json({ ok: true });
}
