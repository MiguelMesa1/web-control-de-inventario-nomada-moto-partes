"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isInsForgeConfigured } from "@/lib/insforge/config";

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

  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return {
      error:
        error?.message ??
        "No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.",
    };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  if (isInsForgeConfigured()) {
    const auth = createAuthActions({ cookies: await cookies() });
    await auth.signOut();
  }
  redirect("/login");
}
