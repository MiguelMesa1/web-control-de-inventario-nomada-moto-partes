import { redirect } from "next/navigation";
import { AdminUsers } from "@/components/admin-users";
import { demoProfile } from "@/lib/demo-data";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
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

export default async function AdminPage() {
  const profile = await getAppProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  let users: UserProfile[] = [
    demoProfile,
    {
      id: "demo-reader",
      displayName: "Laura Gómez",
      email: "laura@nomadamotopartes.com",
      role: "reader",
      active: true,
      isPrimary: false,
    },
    {
      id: "demo-uploader",
      displayName: "Carlos Rincón",
      email: "carlos@nomadamotopartes.com",
      role: "uploader",
      active: true,
      isPrimary: false,
    },
  ];

  if (isInsForgeConfigured()) {
    const insforge = await createInsForgeServerClient();
    const { data } = await insforge.database
      .from("profiles")
      .select("id,email,display_name,role,active,is_primary,last_login_at")
      .order("is_primary", { ascending: false })
      .order("display_name");
    users = ((data ?? []) as DbProfile[]).map((item) => ({
      id: item.id,
      email: item.email,
      displayName: item.display_name,
      role: item.role,
      active: item.active,
      isPrimary: item.is_primary,
      lastLoginAt: item.last_login_at ?? undefined,
    }));
  }

  return <AdminUsers initialUsers={users} isDemo={!isInsForgeConfigured()} />;
}
