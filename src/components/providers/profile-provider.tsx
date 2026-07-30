"use client";

import { createContext, useContext } from "react";
import type { UserProfile } from "@/types/inventory";

const ProfileContext = createContext<UserProfile | null>(null);

export function ProfileProvider({
  value,
  children,
}: {
  value: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
