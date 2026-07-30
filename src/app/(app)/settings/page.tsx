import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/settings-panel";
import { getAppProfile } from "@/lib/insforge/session";

export default async function SettingsPage() {
  const profile = await getAppProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return <SettingsPanel />;
}
