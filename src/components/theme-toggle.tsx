"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const subscribeToHydration = () => () => undefined;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const isDark = resolvedTheme === "dark";
  const nextThemeLabel =
    hydrated && isDark ? "Activar modo claro" : "Activar modo oscuro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={nextThemeLabel}
      title={nextThemeLabel}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {hydrated && isDark ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
    </Button>
  );
}
