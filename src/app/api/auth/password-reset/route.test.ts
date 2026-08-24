import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAuthActions,
  createInsForgeServerClient,
  getAppProfile,
  cookies,
  consumeDistributedRateLimit,
  recordAuditEvent,
  recordSecurityEvent,
} =
  vi.hoisted(() => ({
    createAuthActions: vi.fn(),
    createInsForgeServerClient: vi.fn(),
    getAppProfile: vi.fn(),
    cookies: vi.fn(),
    consumeDistributedRateLimit: vi.fn(),
    recordAuditEvent: vi.fn(),
    recordSecurityEvent: vi.fn(),
  }));

vi.mock("@insforge/sdk/ssr", () => ({ createAuthActions }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/security/distributed-rate-limit", () => ({
  consumeDistributedRateLimit,
  requestIpAddress: vi.fn().mockResolvedValue("127.0.0.1"),
  securityHash: vi.fn((value: string) => value.padEnd(64, "0").slice(0, 64)),
}));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent }));
vi.mock("@/lib/security/events", () => ({ recordSecurityEvent }));

import { POST as completePasswordReset } from "./complete/route";
import { POST as requestPasswordReset } from "./request/route";
import type { UserRole } from "@/types/inventory";

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  displayName: "Administrador",
  role: "admin" as const,
  active: true,
  isPrimary: false,
};

const target: {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  active: boolean;
  is_primary: boolean;
} = {
  id: "20000000-0000-4000-8000-000000000002",
  email: "reader@example.com",
  display_name: "Consulta",
  role: "reader",
  active: true,
  is_primary: false,
};

function request(path: "request" | "complete", body: unknown) {
  return new Request(`https://inventario.example/api/auth/password-reset/${path}`, {
    method: "POST",
    headers: {
      origin: "https://inventario.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function client(options?: {
  profile?: typeof target;
  sendError?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options?.profile ?? target,
    error: null,
  });
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      };
    }
    return { insert };
  });
  return {
    auth: {
      sendResetPasswordEmail: vi.fn().mockResolvedValue({
        data: { success: true },
        error: options?.sendError ?? null,
      }),
      exchangeResetPasswordToken: vi.fn().mockResolvedValue({
        data: { token: "reset-token" },
        error: null,
      }),
      resetPassword: vi.fn().mockResolvedValue({ data: { message: "ok" }, error: null }),
    },
    database: { from },
  };
}

describe("password reset API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppProfile.mockResolvedValue(actor);
    cookies.mockResolvedValue({ delete: vi.fn(), set: vi.fn() });
    consumeDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
    createAuthActions.mockReturnValue({ signOut: vi.fn().mockResolvedValue({ error: null }) });
  });

  it("permite a un administrador enviar un código a un usuario no administrativo", async () => {
    const insforge = client();
    createInsForgeServerClient.mockResolvedValue(insforge);

    const response = await requestPasswordReset(
      request("request", { targetUserId: target.id }),
    );

    expect(response.status).toBe(200);
    expect(insforge.auth.sendResetPasswordEmail).toHaveBeenCalledWith({
      email: target.email,
    });
  });

  it("impide que un administrador secundario restablezca a otro administrador", async () => {
    const insforge = client({ profile: { ...target, role: "admin" } });
    createInsForgeServerClient.mockResolvedValue(insforge);

    const response = await requestPasswordReset(
      request("request", { targetUserId: target.id }),
    );

    expect(response.status).toBe(403);
    expect(insforge.auth.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it("impide que un usuario acceda al restablecimiento de otra cuenta", async () => {
    const insforge = client();
    getAppProfile.mockResolvedValue({ ...actor, id: "reader-1", role: "reader" });
    createInsForgeServerClient.mockResolvedValue(insforge);

    const response = await requestPasswordReset(
      request("request", { targetUserId: target.id }),
    );

    expect(response.status).toBe(403);
    expect(insforge.auth.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it("permite el cambio propio y cierra la sesión al terminar", async () => {
    const insforge = client();
    createInsForgeServerClient.mockResolvedValue(insforge);
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createAuthActions.mockReturnValue({ signOut });

    const response = await completePasswordReset(
      request("complete", {
        code: "123456",
        newPassword: "NomadaSeguro1!",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.signedOut).toBe(true);
    expect(insforge.auth.exchangeResetPasswordToken).toHaveBeenCalledWith({
      email: actor.email,
      code: "123456",
    });
    expect(insforge.auth.resetPassword).toHaveBeenCalledWith({
      newPassword: "NomadaSeguro1!",
      otp: "reset-token",
    });
    expect(signOut).toHaveBeenCalled();
  });

  it("rechaza una contraseña débil antes de consultar el backend", async () => {
    const response = await completePasswordReset(
      request("complete", { code: "123456", newPassword: "debil" }),
    );

    expect(response.status).toBe(400);
    expect(createInsForgeServerClient).not.toHaveBeenCalled();
  });
});
