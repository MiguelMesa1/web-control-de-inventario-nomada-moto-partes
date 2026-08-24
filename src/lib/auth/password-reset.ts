import type { UserProfile } from "@/types/inventory";

export const PASSWORD_RULES_MESSAGE =
  "Usa una contraseña de 8 a 128 caracteres que no sea común ni fácil de adivinar.";

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "contraseña",
  "qwerty123",
  "admin123",
  "nomada123",
  "inventario",
  "motopartes",
]);

export function isStrongPassword(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128 &&
    !COMMON_PASSWORDS.has(password.toLocaleLowerCase("es")) &&
    !/^(.)\1+$/.test(password) &&
    !/^(01234567|12345678|23456789|abcdefgh|qwertyui)$/i.test(password)
  );
}

export function canResetPassword(actor: UserProfile, target: UserProfile) {
  if (actor.id === target.id) return true;
  if (actor.role !== "admin") return false;
  if (target.isPrimary) return false;
  if (target.role === "admin" && !actor.isPrimary) return false;
  return true;
}
