import { NextResponse } from "next/server";
import { getAppProfile } from "@/lib/insforge/session";
import { searchGlobalCatalog } from "@/lib/search/global-search";
import { sanitizeText } from "@/lib/security/input";

export async function GET(request: Request) {
  await getAppProfile();
  const query = sanitizeText(new URL(request.url).searchParams.get("q"), {
    maxLength: 120,
  });
  if (!query || query.length < 2) {
    return NextResponse.json(
      { message: "Escribe al menos 2 caracteres para buscar." },
      { status: 400 },
    );
  }

  const results = await searchGlobalCatalog(query);
  return NextResponse.json(results, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
