"use client";

import { Bell, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

export function ReorderNotifications() {
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      sku: string;
      productName: string;
      productLine?: string;
      available: number;
      reorderPoint: number;
      hasInventoryRecord: boolean;
    }>
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshToken((value) => value + 1);
    window.addEventListener("reorder-alerts:refresh", refresh);
    return () => window.removeEventListener("reorder-alerts:refresh", refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/reorder-alerts", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { alerts?: typeof alerts } | null) => {
        if (payload?.alerts) setAlerts(payload.alerts);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, [refreshToken]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            loaded
              ? `${alerts.length} notificaciones de reorden`
              : "Cargando notificaciones de reorden"
          }
        >
          <Bell />
          {alerts.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.62rem] font-bold leading-4 text-destructive-foreground">
              {alerts.length > 99 ? "99+" : alerts.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>
          <span className="block">Avisos de reorden</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            Ordenados desde la menor disponibilidad.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {alerts.slice(0, 6).map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link href="/reorder" className="items-start gap-3 py-3">
                <ShoppingCart className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {item.productName}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.productLine ? `${item.productLine} · ` : ""}
                    {item.sku} ·{" "}
                    {item.hasInventoryRecord
                      ? `quedan ${number.format(item.available)} · punto ${number.format(item.reorderPoint)}`
                      : `sin registro · punto ${number.format(item.reorderPoint)}`}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
          {!loaded && (
            <DropdownMenuItem disabled>Cargando avisos…</DropdownMenuItem>
          )}
          {loaded && alerts.length === 0 && (
            <DropdownMenuItem disabled>
              No hay productos por solicitar.
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reorder" className="justify-center font-semibold">
            Ver Punto de Reorden
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
