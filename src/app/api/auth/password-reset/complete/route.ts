import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isStrongPassword,
  PASSWORD_RULES_MESSAGE,
} from "@/lib/auth/password-reset";
import { getAppProfile } from "@/lib/insforge/session";
import {
  readJsonObject,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/security/input";
import { requireJsonRequest } from "@/lib/security/request";
import {
  recordPasswordAudit,
  resolvePasswordResetTarget,
} from "../helpers";
import { authCookieSettings } from "@/lib/insforge/auth-cookies";
import { getInsForgeConnectionSettings } from "@/lib/insforge/config";
import {
  serverSessionCookie,
} from "@/lib/auth/server-session";
import {
  consumeDistributedRateLimit,
  requestIpAddress,
  securityHash,
} from "@/lib/security/distributed-rate-limit";
import { recordSecurityEvent } from "@/lib/security/events";

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request, 15_000);
  if (requestError) return requestError;

  const actor = await getAppProfile();
  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const rawTargetId = parsed.data.targetUserId;
  const targetUserId =
    rawTargetId === undefined || rawTargetId === null || rawTargetId === ""
      ? null
      : sanitizeUuid(rawTargetId);
  const code = sanitizeText(parsed.data.code, { maxLength: 6 });
  const newPassword = parsed.data.newPassword;
  if ((rawTargetId && !targetUserId) || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { message: "Escribe el código de 6 dígitos enviado por correo." },
      { status: 400 },
    );
  }
  if (!isStrongPassword(newPassword)) {
    return NextResponse.json({ message: PASSWORD_RULES_MESSAGE }, { status: 400 });
  }

  const resolved = await resolvePasswordResetTarget(actor, targetUserId);
  if (resolved.error || !resolved.target) return resolved.error!;

  const ipHash = securityHash(await requestIpAddress());
  const subjectHash = securityHash(resolved.target.id);
  try {
    const rateLimit = await consumeDistributedRateLimit({
      scope: "password-reset-complete",
      subject: `${ipHash}:${subjectHash}`,
      limit: 6,
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      await recordSecurityEvent({
        eventType: "auth.password_reset_complete",
        outcome: "blocked",
        actorId: actor.id,
        subjectHash,
        ipHash,
        requestPath: "/api/auth/password-reset/complete",
        requestMethod: "POST",
        statusCode: 429,
        details: { retry_after_seconds: rateLimit.retryAfterSeconds },
      });
      return NextResponse.json(
        { message: "Demasiados intentos de código. Solicita uno nuevo más tarde." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
  } catch {
    return NextResponse.json(
      { message: "No pudimos validar la solicitud en este momento." },
      { status: 503 },
    );
  }

  const { data: exchanged, error: exchangeError } =
    await resolved.insforge.auth.exchangeResetPasswordToken({
      email: resolved.target.email,
      code,
    });
  if (exchangeError || !exchanged?.token) {
    await recordSecurityEvent({
      eventType: "auth.password_reset_complete",
      outcome: "failure",
      actorId: actor.id,
      subjectHash,
      ipHash,
      requestPath: "/api/auth/password-reset/complete",
      requestMethod: "POST",
      statusCode: 400,
    });
    return NextResponse.json(
      { message: "El código es inválido o ya venció. Solicita uno nuevo." },
      { status: 400 },
    );
  }

  const { error: resetError } = await resolved.insforge.auth.resetPassword({
    newPassword,
    otp: exchanged.token,
  });
  if (resetError) {
    return NextResponse.json(
      { message: "No pudimos cambiar la contraseña." },
      { status: 400 },
    );
  }

  await recordPasswordAudit(
    resolved.insforge,
    actor,
    resolved.target,
    "profile.password_changed",
  );

  const selfService = actor.id === resolved.target.id;
  if (selfService) {
    const cookieStore = await cookies();
    const connection = getInsForgeConnectionSettings();
    const auth = createAuthActions({
      cookies: cookieStore,
      baseUrl: connection.baseUrl!,
      anonKey: connection.anonKey!,
      ...authCookieSettings,
    });
    await auth.signOut();
    cookieStore.delete(serverSessionCookie.name);
  }
  await recordSecurityEvent({
    eventType: "auth.password_reset_complete",
    outcome: "success",
    actorId: actor.id,
    subjectHash,
    ipHash,
    requestPath: "/api/auth/password-reset/complete",
    requestMethod: "POST",
    statusCode: 200,
    details: { self_service: selfService },
  });
  return NextResponse.json({ ok: true, signedOut: selfService });
}
