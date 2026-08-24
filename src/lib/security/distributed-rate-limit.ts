import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createInsForgeAdminClient } from "@/lib/insforge/server";

type RateLimitPolicy = {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export function securityHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function requestIpAddress() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return requestHeaders.get("x-real-ip") ?? forwarded ?? "unknown";
}

export async function consumeDistributedRateLimit(policy: RateLimitPolicy) {
  const keyHash = securityHash(`${policy.scope}:${policy.subject}`);
  const admin = createInsForgeAdminClient();
  const { data, error } = await admin.database.rpc("consume_security_rate_limit", {
    p_key_hash: keyHash,
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds,
  });
  if (error) {
    throw new Error("No fue posible validar el límite de solicitudes.");
  }
  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row) throw new Error("El servicio de límite de solicitudes no respondió.");
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}
