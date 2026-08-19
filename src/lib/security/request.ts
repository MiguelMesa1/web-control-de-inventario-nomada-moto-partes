import { NextResponse } from "next/server";
import { isAllowedAppOrigin } from "./headers";

const JSON_CONTENT_TYPE = "application/json";

function hasAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return isAllowedAppOrigin(origin, new URL(request.url).origin);
  } catch {
    return false;
  }
}

function isWithinContentLength(request: Request, maxBytes: number) {
  const value = request.headers.get("content-length");
  if (!value) return true;
  const size = Number(value);
  return Number.isSafeInteger(size) && size >= 0 && size <= maxBytes;
}

export function requireSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return NextResponse.json(
      { message: "Origen de solicitud no permitido." },
      { status: 403 },
    );
  }
  if (hasAllowedOrigin(request)) return null;
  return NextResponse.json(
    { message: "Origen de solicitud no permitido." },
    { status: 403 },
  );
}

export function requireJsonRequest(request: Request, maxBytes = 1_000_000) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  if (!request.headers.get("content-type")?.startsWith(JSON_CONTENT_TYPE)) {
    return NextResponse.json(
      { message: "Se requiere contenido JSON." },
      { status: 415 },
    );
  }
  if (!isWithinContentLength(request, maxBytes)) {
    return NextResponse.json(
      { message: "La solicitud supera el tamaño permitido." },
      { status: 413 },
    );
  }
  return null;
}

export function requireMultipartRequest(request: Request, maxBytes: number) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { message: "Se requiere un formulario multipart." },
      { status: 415 },
    );
  }
  if (!isWithinContentLength(request, maxBytes)) {
    return NextResponse.json(
      { message: "El archivo supera el tamaño permitido." },
      { status: 413 },
    );
  }
  return null;
}
