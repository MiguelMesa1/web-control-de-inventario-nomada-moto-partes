const includesAny = (value: string, fragments: string[]) =>
  fragments.some((fragment) => value.includes(fragment));

export function translateLoginError(message?: string) {
  const normalized = message?.trim().toLocaleLowerCase("en") ?? "";

  if (
    includesAny(normalized, [
      "invalid credentials",
      "invalid login credentials",
      "incorrect password",
      "wrong password",
      "user not found",
    ])
  ) {
    return "El correo o la contraseña son incorrectos.";
  }

  if (includesAny(normalized, ["not verified", "not confirmed"])) {
    return "Debes verificar tu correo electrónico antes de iniciar sesión.";
  }

  if (includesAny(normalized, ["too many", "rate limit"])) {
    return "Hiciste demasiados intentos. Espera un momento y vuelve a intentarlo.";
  }

  if (
    includesAny(normalized, [
      "failed to fetch",
      "network",
      "timeout",
      "timed out",
    ])
  ) {
    return "No pudimos conectarnos en este momento. Inténtalo nuevamente.";
  }

  return "No pudimos iniciar sesión. Revisa tus datos e intenta nuevamente.";
}
