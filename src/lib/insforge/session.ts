import { redirect } from "next/navigation";
import { demoProfile } from "@/lib/demo-data";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { UserProfile, UserRole } from "@/types/inventory";

type DbProfile = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  active: boolean;
  is_primary: boolean;
  last_login_at: string | null;
};

const mapProfile = (profile: DbProfile): UserProfile => ({
  id: profile.id,
  email: profile.email,
  displayName: profile.display_name,
  role: profile.role,
  active: profile.active,
  isPrimary: profile.is_primary,
  lastLoginAt: profile.last_login_at ?? undefined,
});

export async function getAppProfile(): Promise<UserProfile> {
  if (!isInsForgeConfigured()) return demoProfile;

  const insforge = await createInsForgeServerClient();
  const { data: authData } = await insforge.auth.getCurrentUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const { data: profileData } = await insforge.database
    .from("profiles")
    .select(
      "id,email,display_name,role,active,is_primary,last_login_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as DbProfile | null;
  // Accounts are provisioned by an existing administrator. Never promote the
  // first authenticated account automatically: public signup would otherwise
  // be an administrator-takeover path on an empty project.
  if (!profile) redirect("/login?error=sin-permisos");

  if (!profile.active || profile.role === "blocked") {
    redirect("/login?error=sin-permisos");
  }

  return mapProfile(profile);
}
