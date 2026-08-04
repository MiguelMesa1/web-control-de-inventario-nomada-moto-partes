import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { isInsForgeConfigured } from "@/lib/insforge/config";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (isInsForgeConfigured()) {
    await updateSession({
      // RequestCookies is read-only in Next.js 16; the SDK only reads this store.
      requestCookies: request.cookies as never,
      responseCookies: response.cookies,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
