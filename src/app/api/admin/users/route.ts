import { NextResponse } from "next/server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import {
  createInsForgeAdminClient,
  createInsForgeServerClient,
} from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import type { UserProfile, UserRole } from "@/types/inventory";
import { requireJsonRequest } from "@/lib/security/request";
import {
  readJsonObject,
  sanitizeEmail,
  sanitizeText,
  sanitizeUuid,
} from "@/lib/security/input";
import {
  isStrongPassword,
  PASSWORD_RULES_MESSAGE,
} from "@/lib/auth/password-reset";
import { recordAuditEvent } from "@/lib/security/audit";

const validRoles: UserRole[] = ["admin", "reader", "uploader", "blocked"];

export async function PATCH(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const actor = await getAppProfile();
  if (actor.role !== "admin") {
    return NextResponse.json({ message: "Acceso administrativo requerido." }, { status: 403 });
  }
  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const id = sanitizeUuid(parsed.data.id);
  const role = parsed.data.role;
  if (!id || typeof role !== "string" || !validRoles.includes(role as UserRole)) {
    return NextResponse.json({ message: "Cambio de permiso inválido." }, { status: 400 });
  }
  const insforge = await createInsForgeServerClient();
  const { data: target } = await insforge.database
    .from("profiles")
    .select("is_primary")
    .eq("id", id)
    .single();
  if ((target as { is_primary?: boolean } | null)?.is_primary) {
    return NextResponse.json({ message: "La cuenta principal está protegida." }, { status: 409 });
  }
  const { error } = await insforge.database
    .from("profiles")
    .update({ role, active: role !== "blocked" })
    .eq("id", id);
  if (error) return NextResponse.json({ message: "No pudimos actualizar el permiso." }, { status: 400 });
  await recordAuditEvent({
    actorId: actor.id,
    action: "profile.role_changed",
    entityType: "profile",
    entityId: id,
    details: { role },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const actor = await getAppProfile();
  if (actor.role !== "admin") {
    return NextResponse.json({ message: "Acceso administrativo requerido." }, { status: 403 });
  }
  const parsed = await readJsonObject(request);
  if (parsed.error) return parsed.error;
  const displayName = sanitizeText(parsed.data.displayName, { maxLength: 120 });
  const email = sanitizeEmail(parsed.data.email);
  const password = typeof parsed.data.password === "string" ? parsed.data.password : "";
  const role = parsed.data.role;
  if (
    !displayName ||
    !email ||
    !isStrongPassword(password) ||
    typeof role !== "string" ||
    !validRoles.includes(role as UserRole)
  ) {
    return NextResponse.json({ message: `Usa un nombre y correo válidos y un permiso permitido. ${PASSWORD_RULES_MESSAGE}` }, { status: 400 });
  }
  if (!isInsForgeConfigured() || !process.env.INSFORGE_API_KEY) {
    return NextResponse.json(
      { message: "Configura INSFORGE_API_KEY en el servidor para crear cuentas sin abrir el registro público." },
      { status: 503 },
    );
  }

  const admin = createInsForgeAdminClient();
  const { data: authData, error: authError } = await admin.auth.signUp({
    email,
    password,
    name: displayName,
    autoConfirm: true,
  });
  const authUser = authData?.user;
  if (authError || !authUser) {
    return NextResponse.json(
      { message: "No pudimos crear la cuenta. Revisa el correo e intenta nuevamente." },
      { status: 400 },
    );
  }

  const { data, error } = await admin.database
    .from("profiles")
    .insert([
      {
        id: authUser.id,
        email,
        display_name: displayName,
        role,
        active: role !== "blocked",
        is_primary: false,
      },
    ])
    .select("id,email,display_name,role,active,is_primary")
    .single();
  if (error) return NextResponse.json({ message: "No pudimos crear el perfil." }, { status: 400 });
  await recordAuditEvent({
    actorId: actor.id,
    action: "profile.created",
    entityType: "profile",
    entityId: authUser.id,
    details: { role, email },
  });
  const row = data as {
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    active: boolean;
    is_primary: boolean;
  };
  const user: UserProfile = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    isPrimary: row.is_primary,
  };
  return NextResponse.json({ user });
}
