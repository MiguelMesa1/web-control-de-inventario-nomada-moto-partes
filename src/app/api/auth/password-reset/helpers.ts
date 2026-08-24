import { NextResponse } from "next/server";
import { canResetPassword } from "@/lib/auth/password-reset";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { UserProfile, UserRole } from "@/types/inventory";
import { recordAuditEvent } from "@/lib/security/audit";

type DbProfile = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  active: boolean;
  is_primary: boolean;
};

function mapProfile(row: DbProfile): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    isPrimary: row.is_primary,
  };
}

export async function resolvePasswordResetTarget(
  actor: UserProfile,
  targetUserId: string | null,
) {
  if (!targetUserId || targetUserId === actor.id) {
    return { insforge: await createInsForgeServerClient(), target: actor, error: null };
  }

  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database
    .from("profiles")
    .select("id,email,display_name,role,active,is_primary")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error || !data) {
    return {
      insforge,
      target: null,
      error: NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 }),
    };
  }

  const target = mapProfile(data as DbProfile);
  if (!canResetPassword(actor, target)) {
    return {
      insforge,
      target: null,
      error: NextResponse.json(
        { message: "No tienes permiso para cambiar la contraseña de esta cuenta." },
        { status: 403 },
      ),
    };
  }

  return { insforge, target, error: null };
}

export async function recordPasswordAudit(
  insforge: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  actor: UserProfile,
  target: UserProfile,
  action: "profile.password_reset_requested" | "profile.password_changed",
) {
  void insforge;
  await recordAuditEvent({
    actorId: actor.id,
    action,
    entityType: "profile",
    entityId: target.id,
    details: {
      self_service: actor.id === target.id,
      target_role: target.role,
    },
  });
}
