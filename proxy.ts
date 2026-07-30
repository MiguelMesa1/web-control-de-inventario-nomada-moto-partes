import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (
    process.env.NEXT_PUBLIC_INSFORGE_URL &&
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  ) {
    await updateSession({
      // RequestCookies is read-only in Next.js 16; the SDK only reads this store.
      requestCookies: request.cookies as never,
      responseCookies: response.cookies,
    });
  }
  return response;
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
