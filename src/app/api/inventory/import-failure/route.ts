import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireJsonRequest } from "@/lib/security/request";
import { readJsonObject, sanitizeOptionalText, sanitizeText } from "@/lib/security/input";

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
  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const filename = sanitizeText(parsed.data.filename, { maxLength: 255 });
  const sourceExportedAt = sanitizeOptionalText(parsed.data.sourceExportedAt, { maxLength: 40 });
  const errorCode = sanitizeOptionalText(parsed.data.errorCode, { maxLength: 80 }) ?? "validation_error";
  const errorMessage = sanitizeText(parsed.data.errorMessage, { maxLength: 2000, multiline: true });
  if (!filename || !errorMessage || (parsed.data.sourceExportedAt != null && parsed.data.sourceExportedAt !== "" && !sourceExportedAt)) {
    return NextResponse.json(
      { message: "El registro de error está incompleto." },
      { status: 400 },
    );
  }
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc("record_failed_import", {
    p_filename: filename,
    p_source_exported_at: sourceExportedAt,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
