import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest } from "@/lib/security/request";

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json(
      { message: "No tienes permiso de carga." },
      { status: 403 },
    );
  }
  const body = (await request.json()) as {
    filename?: string;
    sourceExportedAt?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  if (!body.filename || !body.errorMessage) {
    return NextResponse.json(
      { message: "El registro de error está incompleto." },
      { status: 400 },
    );
  }
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc("record_failed_import", {
    p_filename: body.filename,
    p_source_exported_at: body.sourceExportedAt ?? null,
    p_error_code: body.errorCode ?? "validation_error",
    p_error_message: body.errorMessage,
  });
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
