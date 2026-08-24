import { NextResponse } from "next/server";
import { getAppProfile } from "@/lib/insforge/session";
import { readJsonObject, sanitizeUuid } from "@/lib/security/input";
import { requireJsonRequest } from "@/lib/security/request";
import {
  recordPasswordAudit,
  resolvePasswordResetTarget,
} from "../helpers";
import {
  consumeDistributedRateLimit,
  requestIpAddress,
  securityHash,
} from "@/lib/security/distributed-rate-limit";
import { recordSecurityEvent } from "@/lib/security/events";

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request, 10_000);
  if (requestError) return requestError;

  const actor = await getAppProfile();
  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const rawTargetId = parsed.data.targetUserId;
  const targetUserId =
    rawTargetId === undefined || rawTargetId === null || rawTargetId === ""
      ? null
      : sanitizeUuid(rawTargetId);
  if (rawTargetId && !targetUserId) {
    return NextResponse.json({ message: "Usuario inválido." }, { status: 400 });
  }

  const resolved = await resolvePasswordResetTarget(actor, targetUserId);
  if (resolved.error || !resolved.target) return resolved.error!;

  const ipHash = securityHash(await requestIpAddress());
  const subjectHash = securityHash(resolved.target.id);
  try {
    const rateLimit = await consumeDistributedRateLimit({
      scope: "password-reset-request",
      subject: `${ipHash}:${subjectHash}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      await recordSecurityEvent({
        eventType: "auth.password_reset_request",
        outcome: "blocked",
        actorId: actor.id,
        subjectHash,
        ipHash,
        requestPath: "/api/auth/password-reset/request",
        requestMethod: "POST",
        statusCode: 429,
        details: { retry_after_seconds: rateLimit.retryAfterSeconds },
      });
      return NextResponse.json(
        { message: "Solicitaste demasiados códigos. Espera unos minutos." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
  } catch {
    return NextResponse.json(
      { message: "No pudimos validar la solicitud en este momento." },
      { status: 503 },
    );
  }

  const { error } = await resolved.insforge.auth.sendResetPasswordEmail({
    email: resolved.target.email,
  });
  if (error) {
    await recordSecurityEvent({
      eventType: "auth.password_reset_request",
      outcome: "failure",
      actorId: actor.id,
      subjectHash,
      ipHash,
      requestPath: "/api/auth/password-reset/request",
      requestMethod: "POST",
      statusCode: 400,
    });
    return NextResponse.json(
      { message: "No pudimos enviar el código de seguridad." },
      { status: 400 },
    );
  }

  await recordPasswordAudit(
    resolved.insforge,
    actor,
    resolved.target,
    "profile.password_reset_requested",
  );
  await recordSecurityEvent({
    eventType: "auth.password_reset_request",
    outcome: "success",
    actorId: actor.id,
    subjectHash,
    ipHash,
    requestPath: "/api/auth/password-reset/request",
    requestMethod: "POST",
    statusCode: 200,
  });
  return NextResponse.json({ ok: true });
}
