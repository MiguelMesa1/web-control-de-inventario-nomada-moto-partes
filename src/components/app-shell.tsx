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
  LoaderCircle,
  Menu,
  PackageOpen,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { signOutAction } from "@/app/(auth)/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { ReorderNotifications } from "@/components/reorder-notifications";
import { SessionActivityGuard } from "@/components/session-activity-guard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
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
import type { GlobalSearchResults } from "@/types/search";

type NavItem = { href: string; label: string; icon: LucideIcon };

const operationNavigation: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: Gauge },
  { href: "/inventory", label: "Inventario", icon: Boxes },
  { href: "/plastic-kits", label: "Kit Plástico", icon: PackageOpen },
  { href: "/reorder", label: "Recompra", icon: ShoppingCart },
  { href: "/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/lines", label: "Líneas principales", icon: BarChart3 },
  { href: "/analytics", label: "Analítica", icon: ClipboardClock },
  { href: "/history", label: "Historial", icon: History },
];

const uploadNavigation: NavItem = {
  href: "/uploads",
  label: "Cargar inventario",
  icon: FileUp,
};

const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Usuarios y permisos", icon: Users },
  { href: "/settings", label: "Configuración", icon: Settings2 },
];

/** Same role-based ordering used by the sidebar, extracted so the command
 *  palette and the breadcrumb/mobile title can share one source of truth. */
function useVisibleNavigation(profile: UserProfile) {
  return useMemo(() => {
    const visibleMain =
      profile.role === "admin" || profile.role === "uploader"
        ? [
            ...operationNavigation.slice(0, -1),
            uploadNavigation,
            operationNavigation[operationNavigation.length - 1],
          ]
        : operationNavigation;
    const visibleAdmin = profile.role === "admin" ? adminNavigation : [];
    return { visibleMain, visibleAdmin };
  }, [profile.role]);
}

/** Total de alertas de recompra pendientes, reutilizando el mismo endpoint
 *  que ya alimenta la campana de notificaciones (sin lógica nueva). */
function usePendingReorderCount() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/reorder-alerts", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { total?: number; alerts?: unknown[] } | null) => {
          if (cancelled || !payload) return;
          setTotal(payload.total ?? payload.alerts?.length ?? 0);
        })
        .catch(() => undefined);
    };
    load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("reorder-alerts:refresh", load);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("reorder-alerts:refresh", load);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return total;
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
  badges,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  badges?: Record<string, { value: number; tone: "destructive" | "neutral" }>;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {items.map((item) => {
        const active = pathname === item.href;
        const badge = badges?.[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-[11px] rounded-[10px] px-3 text-[13.5px] font-normal text-foreground-secondary transition-colors duration-150 [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:transition-colors [&>svg]:duration-150",
              active
                ? "bg-primary/[0.16] font-bold text-foreground [&>svg]:text-foreground"
                : "hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-y-[9px] left-0 w-[3px] rounded-full bg-primary"
              />
            )}
            <item.icon aria-hidden="true" />
            <span className="flex-1 truncate">{item.label}</span>
            {badge && badge.value > 0 && (
              <span
                className={cn(
                  "ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                  badge.tone === "destructive"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-foreground/85",
                )}
              >
                {badge.value > 99 ? "99+" : badge.value}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function Navigation({
  profile,
  mobile = false,
  onNavigate,
  reorderCount,
}: {
  profile: UserProfile;
  mobile?: boolean;
  onNavigate?: () => void;
  reorderCount: number | null;
}) {
  const pathname = usePathname();
  const { visibleMain, visibleAdmin } = useVisibleNavigation(profile);
  const badges =
    reorderCount != null
      ? { "/reorder": { value: reorderCount, tone: "destructive" as const } }
      : undefined;

  return (
    <nav
      aria-label="Navegación principal"
      className={cn("flex flex-col gap-6", mobile && "mt-4")}
    >
      <NavGroup
        label="Operación"
        items={visibleMain}
        pathname={pathname}
        onNavigate={onNavigate}
        badges={badges}
      />
      {visibleAdmin.length > 0 && (
        <NavGroup
          label="Administración"
          items={visibleAdmin}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      )}
    </nav>
  );
}

const emptySearchResults: GlobalSearchResults = {
  products: [],
  lines: [],
  orders: [],
};

const orderStatusLabels: Record<GlobalSearchResults["orders"][number]["status"], string> = {
  draft: "Borrador",
  ordered: "Pedido",
  received: "Recibido",
  cancelled: "Cancelado",
};

/** Buscador global (⌘K) para navegación, inventario, líneas y pedidos. */
function CommandPalette({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(emptySearchResults);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const { visibleMain, visibleAdmin } = useVisibleNavigation(profile);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setResults(emptySearchResults);
      setSearchFailed(false);
    }
    onOpenChange(nextOpen);
  };

  const navigationGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (items: NavItem[]) =>
      q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
    return [
      { label: "Operación", items: filter(visibleMain) },
      { label: "Administración", items: filter(visibleAdmin) },
    ].filter((group) => group.items.length > 0);
  }, [query, visibleMain, visibleAdmin]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!open || trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchFailed(false);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("search-failed");
        setResults((await response.json()) as GlobalSearchResults);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults(emptySearchResults);
        setSearchFailed(true);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const hasCatalogResults =
    results.products.length > 0 ||
    results.lines.length > 0 ||
    results.orders.length > 0;
  const hasResults = navigationGroups.length > 0 || hasCatalogResults;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar</DialogTitle>
        </DialogHeader>
        <div className="flex h-12 items-center gap-2.5 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim().length < 2) {
                setResults(emptySearchResults);
                setIsSearching(false);
                setSearchFailed(false);
              }
            }}
            placeholder="Buscar SKU, producto o pedido"
            aria-label="Buscar SKU, producto, línea o pedido"
            aria-controls="global-search-results"
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isSearching ? (
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Buscando" />
          ) : null}
        </div>
        <div id="global-search-results" className="max-h-80 overflow-y-auto p-2" aria-busy={isSearching}>
          {!isSearching && query.trim().length >= 2 && !hasResults && !searchFailed ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query}&rdquo;.
            </p>
          ) : null}
          {searchFailed ? (
            <p className="px-3 py-5 text-center text-sm text-destructive">
              No pudimos completar la búsqueda. Intenta de nuevo.
            </p>
          ) : null}
          {results.products.length > 0 ? (
            <div className="mb-2">
              <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Productos</p>
              {results.products.map((item) => (
                <Link key={item.sku} href={item.href} onClick={() => handleOpenChange(false)} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <Boxes className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.productName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.sku} · {item.productLine} · {item.available.toLocaleString("es-CO")} disp.</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          {results.lines.length > 0 ? (
            <div className="mb-2">
              <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Líneas</p>
              {results.lines.map((item) => (
                <Link key={item.productLine} href={item.href} onClick={() => handleOpenChange(false)} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <BarChart3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {item.productLine}
                </Link>
              ))}
            </div>
          ) : null}
          {results.orders.length > 0 ? (
            <div className="mb-2">
              <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pedidos</p>
              {results.orders.map((item) => (
                <Link key={item.id} href={item.href} onClick={() => handleOpenChange(false)} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.orderNumber}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.supplierName} · {orderStatusLabels[item.status]}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          {navigationGroups.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => handleOpenChange(false)}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const reorderCount = usePendingReorderCount();

  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const current = useMemo(() => {
    const all = [
      ...operationNavigation,
      uploadNavigation,
      ...adminNavigation,
    ];
    const match = all.find((item) => item.href === pathname);
    if (!match) return null;
    const section = adminNavigation.some((item) => item.href === match.href)
      ? "Administración"
      : "Operación";
    return { label: match.label, section };
  }, [pathname]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      <SessionActivityGuard enabled={!isDemo} />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} profile={profile} />

      <aside className="racing-grid fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r bg-card px-[14px] py-[18px] lg:flex">
        <BrandMark dense className="h-[52px] max-w-none rounded-[10px]" />
        <div className="mt-[18px] flex-1 overflow-y-auto pr-1">
          <Navigation profile={profile} reorderCount={reorderCount} />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-muted pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-warning" aria-hidden="true" />
          Trazabilidad 90 días
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur-xl lg:h-[60px] lg:px-7">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menú">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="racing-grid w-[19rem]">
                <SheetHeader className="min-h-11 pr-14">
                  <SheetTitle className="sr-only">Navegación</SheetTitle>
                  <SheetDescription className="sr-only">
                    Accesos principales del portal
                  </SheetDescription>
                  <BrandMark className="h-14 max-w-[11rem]" />
                </SheetHeader>
                <Navigation
                  profile={profile}
                  mobile
                  onNavigate={() => setMobileOpen(false)}
                  reorderCount={reorderCount}
                />
              </SheetContent>
            </Sheet>
            <span className="truncate font-display text-[19px] font-extrabold uppercase leading-none tracking-wide">
              {current?.label ?? "Nómada"}
            </span>
          </div>

          <div className="hidden min-w-0 items-center gap-1.5 truncate text-[13px] lg:flex">
            {current ? (
              <>
                <span className="text-muted-foreground">{current.section}</span>
                <span className="text-muted-foreground" aria-hidden="true">
                  ›
                </span>
                <span className="truncate font-semibold text-foreground">
                  {current.label}
                </span>
              </>
            ) : (
              <span className="font-semibold text-foreground">Nómada Moto Partes</span>
            )}
          </div>

          <div className="hidden flex-1 justify-center lg:flex">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-9 w-full max-w-[400px] items-center gap-2 rounded-[9px] border border-input bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate text-left">
                Buscar SKU, producto o pedido
              </span>
              <kbd className="hidden shrink-0 items-center rounded border border-input bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <ReorderNotifications />
            <ThemeToggle />
            <Separator orientation="vertical" className="mx-1 hidden h-[22px] lg:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto min-h-11 gap-3 px-2 py-1.5">
                  <Avatar className="size-[30px] lg:size-8">
                    <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
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
                  <ChevronDown className="hidden xl:block" />
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
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      {profile.role === "admin" ? "Configuración" : "Mi seguridad"}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
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

        <main id="main-content" className="page-enter p-4 sm:p-6 lg:px-8 lg:py-[26px]">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
