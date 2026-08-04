"use client";

import {
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardClock,
  ClipboardList,
  FileUp,
  Gauge,
  History,
  Menu,
  PackageOpen,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { signOutAction } from "@/app/(auth)/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { ReorderNotifications } from "@/components/reorder-notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/inventory";

const mainNavigation = [
  { href: "/dashboard", label: "Inicio", icon: Gauge },
  { href: "/inventory", label: "Inventario", icon: Boxes },
  { href: "/plastic-kits", label: "Kit Plástico", icon: PackageOpen },
  { href: "/reorder", label: "Punto de Reorden", icon: ShoppingCart },
  { href: "/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/lines", label: "Líneas principales", icon: BarChart3 },
  { href: "/analytics", label: "Analítica", icon: ClipboardClock },
  { href: "/history", label: "Historial", icon: History },
];

const uploadNavigation = {
  href: "/uploads",
  label: "Cargar inventario",
  icon: FileUp,
};

const adminNavigation = [
  { href: "/admin", label: "Usuarios y permisos", icon: Users },
  { href: "/settings", label: "Configuración", icon: Settings2 },
];

function Navigation({
  profile,
  mobile = false,
  onNavigate,
}: {
  profile: UserProfile;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleMain =
    profile.role === "admin" || profile.role === "uploader"
      ? [
          ...mainNavigation.slice(0, -1),
          uploadNavigation,
          mainNavigation[mainNavigation.length - 1],
        ]
      : mainNavigation;
  const visibleAdmin = profile.role === "admin" ? adminNavigation : [];

  return (
    <nav
      aria-label="Navegación principal"
      className={cn("flex flex-col gap-6", mobile && "mt-4")}
    >
      <div className="flex flex-col gap-1">
        <p className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Operación
        </p>
        {visibleMain.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 [&>svg]:size-5",
                active
                  ? "bg-primary text-primary-foreground shadow-[inset_3px_0_0_hsl(var(--primary-foreground)/0.75),0_5px_18px_hsl(var(--primary)/0.12)]"
                  : "text-muted-foreground hover:bg-muted/75 hover:text-foreground",
              )}
            >
              <item.icon aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {visibleAdmin.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Administración
          </p>
          {visibleAdmin.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 [&>svg]:size-5",
                  active
                    ? "bg-primary text-primary-foreground shadow-[inset_3px_0_0_hsl(var(--primary-foreground)/0.75),0_5px_18px_hsl(var(--primary)/0.12)]"
                    : "text-muted-foreground hover:bg-muted/75 hover:text-foreground",
                )}
              >
                <item.icon aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

export function AppShell({
  profile,
  isDemo,
  children,
}: {
  profile: UserProfile;
  isDemo: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      <aside className="racing-grid fixed inset-y-0 left-0 z-40 hidden w-72 border-r bg-card/95 p-5 shadow-[8px_0_30px_hsl(var(--foreground)/0.025)] backdrop-blur xl:flex xl:flex-col">
        <BrandMark />
        <div className="mt-9 flex-1 overflow-y-auto pr-1">
          <Navigation profile={profile} />
        </div>
        <div className="rounded-2xl border border-primary/30 bg-secondary p-4 text-secondary-foreground">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Datos protegidos
          </div>
          <p className="mt-2 text-xs leading-relaxed text-secondary-foreground/70">
            Cada carga válida queda trazable durante 90 días.
          </p>
        </div>
      </aside>

      <div className="xl:pl-72">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b bg-background/90 px-4 shadow-[0_1px_0_hsl(var(--border)/0.45)] backdrop-blur-xl md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 xl:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menú">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem]">
                <SheetHeader>
                  <SheetTitle className="sr-only">Navegación</SheetTitle>
                  <SheetDescription className="sr-only">
                    Accesos principales del portal
                  </SheetDescription>
                  <BrandMark />
                </SheetHeader>
                <Navigation
                  profile={profile}
                  mobile
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <BrandMark compact />
          </div>

          <div className="hidden items-center gap-3 xl:flex">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_rgba(240,227,0,0.8)]" />
            <p className="text-sm font-semibold text-muted-foreground">
              {isDemo ? "Modo demostración" : "Conectado"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <ReorderNotifications />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto min-h-11 gap-3 px-2 py-1.5">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left xl:block">
                    <span className="block max-w-44 truncate text-sm font-semibold">
                      {profile.displayName}
                    </span>
                    <span className="block text-xs capitalize text-muted-foreground">
                      {profile.isPrimary ? "Admin principal" : profile.role}
                    </span>
                  </span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <span className="block truncate">{profile.email}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Sesión protegida
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile.role === "admin" && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">Configuración</Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  disabled={isSigningOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    handleSignOut();
                  }}
                >
                  {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main-content" className="page-enter p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
