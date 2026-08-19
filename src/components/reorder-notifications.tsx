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
      minimumStock: number;
      maximumStock: number;
      primarySupplier?: string;
      hasInventoryRecord: boolean;
    }>
  >([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshToken((value) => value + 1);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("reorder-alerts:refresh", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    return () => {
      window.removeEventListener("reorder-alerts:refresh", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/reorder-alerts", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { alerts?: typeof alerts; total?: number } | null) => {
        if (payload?.alerts) {
          setAlerts(payload.alerts);
          setTotal(payload.total ?? payload.alerts.length);
        }
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
              ? `${total} alertas de reposición`
              : "Cargando alertas de reposición"
          }
        >
          <Bell />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.62rem] font-bold leading-4 text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>
          <span className="block">Alertas de reposición</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {total > alerts.length
              ? `Mostrando ${alerts.length} de ${total} productos por revisar.`
              : "Productos que ya necesitan revisión de compra."}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {alerts.slice(0, 6).map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={`/reorder?sku=${encodeURIComponent(item.sku)}`}
                className="items-start gap-3 py-3"
              >
                <ShoppingCart className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {item.productName}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.productLine ? `${item.productLine} · ` : ""}
                    {item.sku} ·{" "}
                    {item.hasInventoryRecord
                      ? `quedan ${number.format(item.available)} · mínimo ${number.format(item.minimumStock)}`
                      : `sin registro · mínimo ${number.format(item.minimumStock)}`}
                    {item.primarySupplier
                      ? ` · ${item.primarySupplier}`
                      : ""}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
          {!loaded && (
            <DropdownMenuItem disabled>Cargando avisos…</DropdownMenuItem>
          )}
          {loaded && total === 0 && (
            <DropdownMenuItem disabled>
              No hay productos por solicitar.
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reorder" className="justify-center font-semibold">
            Ver recompra
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
