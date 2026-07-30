import { NextResponse } from "next/server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import {
  createInsForgeAdminClient,
  createInsForgeServerClient,
} from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import type { UserProfile, UserRole } from "@/types/inventory";
import { requireJsonRequest } from "@/lib/security/request";

const validRoles: UserRole[] = ["admin", "reader", "uploader", "blocked"];

export async function PATCH(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const actor = await getAppProfile();
  if (actor.role !== "admin") {
    return NextResponse.json({ message: "Acceso administrativo requerido." }, { status: 403 });
  }
  const body = (await request.json()) as { id?: string; role?: UserRole };
  if (!body.id || !body.role || !validRoles.includes(body.role)) {
    return NextResponse.json({ message: "Cambio de permiso inválido." }, { status: 400 });
  }
  const insforge = await createInsForgeServerClient();
  const { data: target } = await insforge.database
    .from("profiles")
    .select("is_primary")
    .eq("id", body.id)
    .single();
  if ((target as { is_primary?: boolean } | null)?.is_primary) {
    return NextResponse.json({ message: "La cuenta principal está protegida." }, { status: 409 });
  }
  const { error } = await insforge.database
    .from("profiles")
    .update({ role: body.role, active: body.role !== "blocked" })
    .eq("id", body.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await insforge.database.from("audit_events").insert([
    {
      actor_id: actor.id,
      action: "profile.role_changed",
      entity_type: "profile",
      entity_id: body.id,
      details: { role: body.role },
    },
  ]);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const requestError = requireJsonRequest(request);
  if (requestError) return requestError;
  const actor = await getAppProfile();
  if (actor.role !== "admin") {
    return NextResponse.json({ message: "Acceso administrativo requerido." }, { status: 403 });
  }
  const body = (await request.json()) as {
    displayName?: string;
    email?: string;
    password?: string;
    role?: UserRole;
  };
  if (
    !body.displayName ||
    !body.email ||
    !body.password ||
    body.password.length < 8 ||
    !body.role ||
    !validRoles.includes(body.role)
  ) {
    return NextResponse.json({ message: "Nombre, correo, contraseña y permiso son obligatorios." }, { status: 400 });
  }
  if (!isInsForgeConfigured() || !process.env.INSFORGE_API_KEY) {
    return NextResponse.json(
      { message: "Configura INSFORGE_API_KEY en el servidor para crear cuentas sin abrir el registro público." },
      { status: 503 },
    );
  }

  const admin = createInsForgeAdminClient();
  const { data: authData, error: authError } = await admin.auth.signUp({
    email: body.email,
    password: body.password,
    name: body.displayName,
    autoConfirm: true,
  });
  const authUser = authData?.user;
  if (authError || !authUser) {
    return NextResponse.json(
      { message: authError?.message ?? "InsForge rechazó la cuenta." },
      { status: 400 },
    );
  }

  const { data, error } = await admin.database
    .from("profiles")
    .insert([
      {
        id: authUser.id,
        email: body.email,
        display_name: body.displayName,
        role: body.role,
        active: body.role !== "blocked",
        is_primary: false,
      },
    ])
    .select("id,email,display_name,role,active,is_primary")
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await admin.database.from("audit_events").insert([
    {
      actor_id: actor.id,
      action: "profile.created",
      entity_type: "profile",
      entity_id: authUser.id,
      details: { role: body.role, email: body.email },
    },
  ]);
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
