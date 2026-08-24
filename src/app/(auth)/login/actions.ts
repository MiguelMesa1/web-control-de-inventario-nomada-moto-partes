"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  getInsForgeConnectionSettings,
  isInsForgeConfigured,
} from "@/lib/insforge/config";
import { translateLoginError } from "@/lib/insforge/auth-errors";
import { authCookieSettings } from "@/lib/insforge/auth-cookies";
import {
  createServerSessionValue,
  serverSessionCookie,
} from "@/lib/auth/server-session";
import {
  consumeDistributedRateLimit,
  requestIpAddress,
  securityHash,
} from "@/lib/security/distributed-rate-limit";
import { recordSecurityEvent } from "@/lib/security/events";

export type LoginState = {
  error?: string;
};

export async function signInAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isInsForgeConfigured()) {
    redirect("/dashboard");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Escribe tu correo y contraseña para continuar." };
  }

  const ipAddress = await requestIpAddress();
  const subjectHash = securityHash(email.toLowerCase());
  const ipHash = securityHash(ipAddress);
  try {
    const rateLimit = await consumeDistributedRateLimit({
      scope: "login",
      subject: `${ipHash}:${subjectHash}`,
      limit: 8,
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      after(() =>
        recordSecurityEvent({
          eventType: "auth.login",
          outcome: "blocked",
          subjectHash,
          ipHash,
          requestPath: "/login",
          requestMethod: "POST",
          statusCode: 429,
          details: { retry_after_seconds: rateLimit.retryAfterSeconds },
        }),
      );
      return { error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." };
    }
  } catch {
    return { error: "No pudimos validar el acceso en este momento. Intenta nuevamente." };
  }

  const cookieStore = await cookies();
  const connection = getInsForgeConnectionSettings();
  const auth = createAuthActions({
    cookies: cookieStore,
    baseUrl: connection.baseUrl!,
    anonKey: connection.anonKey!,
    ...authCookieSettings,
  });
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    after(() =>
      recordSecurityEvent({
        eventType: "auth.login",
        outcome: "failure",
        subjectHash,
        ipHash,
        requestPath: "/login",
        requestMethod: "POST",
        statusCode: 401,
      }),
    );
    return {
      error: translateLoginError(error?.message),
    };
  }

  const sessionValue = await createServerSessionValue();
  if (sessionValue) {
    cookieStore.set(serverSessionCookie.name, sessionValue, serverSessionCookie.options);
  }
  after(() =>
    recordSecurityEvent({
      eventType: "auth.login",
      outcome: "success",
      actorId: data.user.id,
      subjectHash,
      ipHash,
      requestPath: "/login",
      requestMethod: "POST",
      statusCode: 303,
    }),
  );

  redirect("/dashboard");
}

export async function signOutAction() {
  if (isInsForgeConfigured()) {
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
  redirect("/login");
}
