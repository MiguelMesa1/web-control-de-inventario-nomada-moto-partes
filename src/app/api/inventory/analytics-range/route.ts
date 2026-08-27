import { NextResponse } from "next/server";
import { loadAnalyticsRange } from "@/lib/inventory/data";
import { getAppProfile } from "@/lib/insforge/session";
import { getBogotaCalendarDate } from "@/lib/inventory/source-date";

export async function GET(request: Request) {
  await getAppProfile();
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to) || from > to || to > getBogotaCalendarDate()) {
    return NextResponse.json({ message: "El rango de fechas no es válido." }, { status: 400 });
  }
  try {
    return NextResponse.json(await loadAnalyticsRange(from, to), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ message: "No pudimos consultar ese periodo. Intenta nuevamente." }, { status: 503 });
  }
}
