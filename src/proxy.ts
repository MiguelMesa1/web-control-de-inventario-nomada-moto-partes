import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import {
  buildContentSecurityPolicy,
  isAllowedAppOrigin,
} from "@/lib/security/headers";
import { checkRateLimit } from "@/lib/security/rate-limit";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function clientIdentity(request: NextRequest) {
  const session = request.cookies.get("insforge_access_token")?.value;
  if (session) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(session),
    );
    const fingerprint = Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `session:${fingerprint}`;
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${request.headers.get("x-real-ip") ?? forwarded ?? "unknown"}`;
}

function rateLimitFor(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/api/auth/refresh") return { limit: 30, windowMs: 60_000 };
  if (pathname === "/api/inventory/import") return { limit: 10, windowMs: 10 * 60_000 };
  if (UNSAFE_METHODS.has(request.method)) return { limit: 90, windowMs: 60_000 };
  return { limit: 300, windowMs: 60_000 };
}

function applySecurityHeaders(response: NextResponse, csp: string, nonce: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const requestOrigin = request.nextUrl.origin;
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") {
      if (!isAllowedAppOrigin(origin, requestOrigin)) {
        return applySecurityHeaders(
          NextResponse.json({ message: "Origen no permitido." }, { status: 403 }),
          csp,
          nonce,
        );
      }
      const preflight = new NextResponse(null, { status: 204 });
      preflight.headers.set("Access-Control-Allow-Origin", origin!);
      preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      preflight.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
      preflight.headers.set("Access-Control-Allow-Credentials", "true");
      preflight.headers.set("Access-Control-Max-Age", "600");
      preflight.headers.set("Vary", "Origin");
      return applySecurityHeaders(preflight, csp, nonce);
    }
    if (
      UNSAFE_METHODS.has(request.method) &&
      !isAllowedAppOrigin(origin, requestOrigin)
    ) {
      return applySecurityHeaders(
        NextResponse.json({ message: "Origen no permitido." }, { status: 403 }),
        csp,
        nonce,
      );
    }

    const policy = rateLimitFor(request);
    const result = checkRateLimit({
      key: `${await clientIdentity(request)}:${request.method}:${request.nextUrl.pathname}`,
      ...policy,
    });
    if (!result.allowed) {
      const limited = NextResponse.json(
        { message: "Demasiadas solicitudes. Intenta nuevamente en unos segundos." },
        { status: 429 },
      );
      limited.headers.set("Retry-After", String(result.retryAfterSeconds));
      limited.headers.set("RateLimit-Limit", String(result.limit));
      limited.headers.set("RateLimit-Remaining", "0");
      limited.headers.set("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
      return applySecurityHeaders(limited, csp, nonce);
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isInsForgeConfigured()) {
    await updateSession({
      // RequestCookies is read-only in Next.js 16; the SDK only reads this store.
      requestCookies: request.cookies as never,
      responseCookies: response.cookies,
    });
  }
  const origin = request.headers.get("origin");
  if (origin && isAllowedAppOrigin(origin, request.nextUrl.origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.append("Vary", "Origin");
  }
  return applySecurityHeaders(response, csp, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
