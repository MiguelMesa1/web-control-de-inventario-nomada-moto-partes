import { createAdminClient } from "@insforge/sdk";
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { authCookieSettings } from "@/lib/insforge/auth-cookies";
import { getInsForgeConnectionSettings } from "@/lib/insforge/config";

export async function createInsForgeServerClient() {
  const { baseUrl, anonKey } = getInsForgeConnectionSettings();
  if (!baseUrl || !anonKey) {
    throw new Error("Faltan INSFORGE_URL e INSFORGE_ANON_KEY.");
  }
  return createServerClient({
    cookies: await cookies(),
    baseUrl,
    anonKey,
    ...authCookieSettings,
  });
}

export function createInsForgeAdminClient() {
  const { baseUrl } = getInsForgeConnectionSettings();
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Faltan INSFORGE_URL e INSFORGE_API_KEY.");
  }
  return createAdminClient({ baseUrl, apiKey });
}
