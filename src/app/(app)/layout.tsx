import { AppShell } from "@/components/app-shell";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { getAppProfile } from "@/lib/insforge/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAppProfile();

  return (
    <ProfileProvider value={profile}>
      <AppShell profile={profile} isDemo={!isInsForgeConfigured()}>
        {children}
      </AppShell>
    </ProfileProvider>
  );
}
