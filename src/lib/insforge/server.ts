import { createAdminClient } from "@insforge/sdk";
import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

export async function createInsForgeServerClient() {
  return createServerClient({
    cookies: await cookies(),
  });
}

export function createInsForgeAdminClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Faltan NEXT_PUBLIC_INSFORGE_URL e INSFORGE_API_KEY.");
  }
  return createAdminClient({ baseUrl, apiKey });
}
