import { createAdminClient } from "npm:@insforge/sdk";

const jsonHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...jsonHeaders, allow: "POST" },
    });
  }

  const expectedToken = Deno.env.get("INVENTORY_RETENTION_TOKEN");
  const requestToken = request.headers.get("x-retention-token");
  if (!expectedToken || requestToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("API_KEY");
  if (!baseUrl || !apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration missing" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const insforge = createAdminClient({ baseUrl, apiKey });
  const { data, error } = await insforge.database.rpc(
    "cleanup_inventory_history",
  );
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ deletedSnapshots: data ?? 0 }), {
    status: 200,
    headers: jsonHeaders,
  });
}
