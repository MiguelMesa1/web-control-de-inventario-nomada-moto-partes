import {
  clearAuthCookies,
  updateSession,
} from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";
import {
  getInsForgeConnectionSettings,
  isInsForgeConfigured,
} from "@/lib/insforge/config";
import {
  buildContentSecurityPolicy,
  isAllowedAppOrigin,
} from "@/lib/security/headers";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authCookieSettings } from "@/lib/insforge/auth-cookies";
import {
  createServerSessionValue,
  readServerSessionValue,
  serverSessionCookie,
  serverSessionExpired,
} from "@/lib/auth/server-session";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const PUBLIC_PATHS = new Set(["/", "/login", "/api/auth/refresh"]);

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
  if (pathname === "/api/auth/password-reset/request") {
    return { limit: 5, windowMs: 15 * 60_000 };
  }
  if (pathname === "/api/auth/password-reset/complete") {
    return { limit: 10, windowMs: 15 * 60_000 };
  }
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
  const hasAuthCookie = Boolean(
    request.cookies.get("insforge_access_token")?.value ||
      request.cookies.get("insforge_refresh_token")?.value,
  );

  if (!ALLOWED_METHODS.has(request.method)) {
    const rejected = NextResponse.json(
      { message: "Método no permitido." },
      { status: 405, headers: { Allow: [...ALLOWED_METHODS].join(", ") } },
    );
    return applySecurityHeaders(rejected, csp, nonce);
  }

  const origin = request.headers.get("origin");
  if (
    UNSAFE_METHODS.has(request.method) &&
    origin &&
    !isAllowedAppOrigin(origin, request.nextUrl.origin)
  ) {
    return applySecurityHeaders(
      NextResponse.json({ message: "Origen no permitido." }, { status: 403 }),
      csp,
      nonce,
    );
  }

  if (
    isInsForgeConfigured() &&
    !hasAuthCookie &&
    !PUBLIC_PATHS.has(request.nextUrl.pathname)
  ) {
    const unauthorized = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ message: "Inicia sesión para continuar." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    return applySecurityHeaders(unauthorized, csp, nonce);
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const requestOrigin = request.nextUrl.origin;
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
    if (UNSAFE_METHODS.has(request.method) && !isAllowedAppOrigin(origin, requestOrigin)) {
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

  let sessionTimes = hasAuthCookie
    ? await readServerSessionValue(request.cookies.get(serverSessionCookie.name)?.value)
    : null;
  if (hasAuthCookie && sessionTimes && serverSessionExpired(sessionTimes)) {
    const expired = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ message: "La sesión venció. Inicia sesión nuevamente." }, { status: 401 })
      : NextResponse.redirect(new URL("/login?session=expired", request.url));
    clearAuthCookies(expired.cookies, authCookieSettings);
    expired.cookies.delete(serverSessionCookie.name);
    return applySecurityHeaders(expired, csp, nonce);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isInsForgeConfigured()) {
    const { baseUrl, anonKey } = getInsForgeConnectionSettings();
    const sessionResult = await updateSession({
      // RequestCookies is read-only in Next.js 16; the SDK only reads this store.
      requestCookies: request.cookies as never,
      responseCookies: response.cookies,
      baseUrl: baseUrl!,
      anonKey: anonKey!,
      ...authCookieSettings,
    });
    if (sessionResult.error) {
      response.cookies.delete(serverSessionCookie.name);
    } else if (hasAuthCookie || sessionResult.accessToken) {
      const now = Math.floor(Date.now() / 1000);
      sessionTimes ??= { issuedAt: now, lastActivityAt: now };
      const sessionValue = await createServerSessionValue({
        issuedAt: sessionTimes.issuedAt,
        lastActivityAt: now,
      });
      if (sessionValue) {
        response.cookies.set(
          serverSessionCookie.name,
          sessionValue,
          serverSessionCookie.options,
        );
      }
    }
  }
  if (origin && isAllowedAppOrigin(origin, request.nextUrl.origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.append("Vary", "Origin");
  }
  return applySecurityHeaders(response, csp, nonce);
}

export const config = {
  // Los archivos públicos deben quedar fuera de la sesión: el navegador y el
  // optimizador de imágenes los solicitan sin las cookies de autenticación.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
