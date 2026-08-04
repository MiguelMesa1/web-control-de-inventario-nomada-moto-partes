import { describe, expect, it } from "vitest";
import { translateLoginError } from "@/lib/insforge/auth-errors";

describe("translateLoginError", () => {
  it("traduce las credenciales inválidas", () => {
    expect(translateLoginError("Invalid credentials")).toBe(
      "El correo o la contraseña son incorrectos.",
    );
  });

  it("traduce los errores frecuentes de autenticación", () => {
    expect(translateLoginError("Email not verified")).toContain(
      "verificar tu correo electrónico",
    );
    expect(translateLoginError("Too many requests")).toContain(
      "demasiados intentos",
    );
    expect(translateLoginError("Request timed out")).toContain(
      "No pudimos conectarnos",
    );
  });

  it("no expone mensajes técnicos desconocidos", () => {
    expect(translateLoginError("Internal provider failure")).toBe(
      "No pudimos iniciar sesión. Revisa tus datos e intenta nuevamente.",
    );
  });
});
