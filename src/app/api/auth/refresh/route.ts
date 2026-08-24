import { refreshAuth } from "@insforge/sdk/ssr";
import { authCookieSettings } from "@/lib/insforge/auth-cookies";
import { getInsForgeConnectionSettings } from "@/lib/insforge/config";

export async function POST(request: Request) {
  const { baseUrl, anonKey } = getInsForgeConnectionSettings();
  if (!baseUrl || !anonKey) {
    return Response.json(
      { ok: false, message: "El servicio de autenticación no está configurado." },
      { status: 503 },
    );
  }
  const result = await refreshAuth({
    request,
    baseUrl,
    anonKey,
    ...authCookieSettings,
  });
  return new Response(
    JSON.stringify(
      result.error
        ? { ok: false, message: "La sesión no pudo renovarse." }
        : { ok: true },
    ),
    {
      status: result.response.status,
      headers: result.response.headers,
    },
  );
}
