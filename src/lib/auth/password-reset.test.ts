import { describe, expect, it } from "vitest";
import { canResetPassword, isStrongPassword } from "./password-reset";
import type { UserProfile } from "@/types/inventory";

const profile = (overrides: Partial<UserProfile>): UserProfile => ({
  id: "reader-1",
  email: "reader@example.com",
  displayName: "Reader",
  role: "reader",
  active: true,
  isPrimary: false,
  ...overrides,
});

describe("password reset permissions", () => {
  it("permite que cada usuario cambie su propia contraseña", () => {
    const reader = profile({});
    expect(canResetPassword(reader, reader)).toBe(true);
  });

  it("permite a un administrador restablecer cuentas no administrativas", () => {
    const admin = profile({ id: "admin-1", role: "admin" });
    expect(canResetPassword(admin, profile({ role: "blocked" }))).toBe(true);
  });

  it("solo permite al principal restablecer a otro administrador", () => {
    const target = profile({ id: "admin-2", role: "admin" });
    expect(
      canResetPassword(profile({ id: "admin-1", role: "admin" }), target),
    ).toBe(false);
    expect(
      canResetPassword(
        profile({ id: "primary", role: "admin", isPrimary: true }),
        target,
      ),
    ).toBe(true);
  });

  it("impide restablecer la cuenta principal desde otra cuenta", () => {
    const primary = profile({ id: "primary", role: "admin", isPrimary: true });
    expect(
      canResetPassword(
        profile({ id: "admin-1", role: "admin", isPrimary: false }),
        primary,
      ),
    ).toBe(false);
  });
});

describe("strong password validation", () => {
  it("exige entre 8 y 128 caracteres sin imponer reglas de composición", () => {
    expect(isStrongPassword("caballo azul enorme" )).toBe(true);
    expect(isStrongPassword("solo-letras-seguras" )).toBe(true);
    expect(isStrongPassword("Corta1!" )).toBe(false);
  });

  it("rechaza contraseñas comunes o triviales", () => {
    expect(isStrongPassword("12345678" )).toBe(false);
    expect(isStrongPassword("password" )).toBe(false);
    expect(isStrongPassword("aaaaaaaa" )).toBe(false);
  });
});
