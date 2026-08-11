"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  FileSpreadsheet,
  History,
  LoaderCircle,
  PackageSearch,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ProductHistoryEvent,
  ProductHistoryPayload,
  ProductHistorySubject,
} from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

const date = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function eventPresentation(event: ProductHistoryEvent) {
  if (event.kind === "increase") {
    return {
      label: "Entrada",
      Icon: ArrowUpRight,
      badgeClass: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      iconClass: "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (event.kind === "decrease") {
    return {
      label: "Disminución",
      Icon: ArrowDownRight,
      badgeClass: "border-destructive/35 bg-destructive/10 text-destructive",
      iconClass: "border-destructive/35 bg-destructive/10 text-destructive",
    };
  }
  return {
    label: "Primer registro",
    Icon: History,
    badgeClass: "border-border bg-muted text-muted-foreground",
    iconClass: "border-border bg-muted text-muted-foreground",
  };
}

export function ProductHistorySheet({
  item,
  open,
  onOpenChange,
}: {
  item: ProductHistorySubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [payload, setPayload] = useState<ProductHistoryPayload | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const sku = item?.sku;
  const warehouse = item?.warehouse;
  const loading = Boolean(open && item && !payload && !error);

  useEffect(() => {
    if (!open || !sku || !warehouse) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(
          `/api/inventory/product-history?sku=${encodeURIComponent(sku)}&warehouse=${encodeURIComponent(warehouse)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = (await response.json()) as {
          data?: ProductHistoryPayload;
          message?: string;
        };
        if (!response.ok || !result.data) {
          throw new Error(result.message ?? "No pudimos consultar el historial.");
        }
        setPayload(result.data);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setPayload(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No pudimos consultar el historial.",
        );
      }
    })();

    return () => controller.abort();
  }, [open, reloadKey, sku, warehouse]);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPayload(null);
          setError("");
        }
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent className="w-full overscroll-contain overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-12 text-left">
          <Badge variant="outline" className="mb-1 w-fit gap-1.5 border-primary/30 bg-primary/10">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Últimos 90 días
          </Badge>
          <SheetTitle className="font-display text-2xl uppercase sm:text-3xl">
            Historial del SKU
          </SheetTitle>
          <SheetDescription>
            Entradas, disminuciones y cargas donde cambió la existencia disponible.
          </SheetDescription>
        </SheetHeader>

        {item ? (
          <div className="mt-5 flex flex-col gap-5">
            <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Producto seleccionado">
              <div className="border-l-4 border-primary p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-primary-foreground dark:text-primary">
                      {item.sku}
                    </p>
                    <h2 className="mt-1 text-lg font-bold leading-tight">
                      {item.productName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.productLine} · {item.warehouse}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-primary/15 px-3 py-2 text-right">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Disponible
                    </p>
                    <p className="font-display text-2xl font-bold tabular-nums">
                      {number.format(item.available)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {loading ? (
              <div className="flex flex-col gap-3" aria-label="Consultando historial">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Consultando movimientos…
                </div>
                {[0, 1, 2].map((value) => (
                  <Skeleton key={value} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : error ? (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
                <div className="max-w-sm">
                  <PackageSearch className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 font-semibold">No pudimos cargar el historial</p>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 min-h-11 gap-2"
                    onClick={() => {
                      setError("");
                      setPayload(null);
                      setReloadKey((value) => value + 1);
                    }}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reintentar
                  </Button>
                </div>
              </div>
            ) : payload && payload.events.length > 0 ? (
              <>
                <section className="grid grid-cols-2 gap-3" aria-label="Resumen del historial">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Cambios detectados</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums">
                      {number.format(payload.changes)}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Cambio neto</p>
                    <p className="mt-1 font-display text-xl font-bold tabular-nums">
                      {payload.netChange > 0 ? "+" : ""}{number.format(payload.netChange)}
                    </p>
                  </div>
                </section>

                <section aria-labelledby="sku-timeline-title">
                  <div className="mb-4 flex items-center gap-2">
                    <History className="size-5 text-primary" aria-hidden="true" />
                    <h2 id="sku-timeline-title" className="font-display text-xl font-bold uppercase">
                      Línea de tiempo
                    </h2>
                  </div>
                  <ol className="relative ml-4 border-l border-border pl-6" aria-label={`Movimientos de ${item.sku}`}>
                    {payload.events.map((event) => {
                      const presentation = eventPresentation(event);
                      const EventIcon = presentation.Icon;
                      return (
                        <li key={event.snapshotId} className="relative pb-5 last:pb-0">
                          <span
                            className={`absolute -left-[2.55rem] top-0 grid size-8 place-items-center rounded-full border-2 bg-background ${presentation.iconClass}`}
                          >
                            <EventIcon className="size-4" aria-hidden="true" />
                          </span>
                          <article className="rounded-2xl border bg-card p-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <time className="text-sm font-semibold" dateTime={event.date}>
                                {date.format(new Date(event.date))}
                              </time>
                              <Badge variant="outline" className={presentation.badgeClass}>
                                {presentation.label}
                                {event.change !== null
                                  ? ` ${event.change > 0 ? "+" : ""}${number.format(event.change)}`
                                  : ""}
                              </Badge>
                            </div>
                            <div className="mt-3 flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
                              <FileSpreadsheet className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                              <span className="break-all">{event.filename}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                              {event.previousAvailable !== null ? (
                                <>
                                  <span className="tabular-nums text-muted-foreground">
                                    {number.format(event.previousAvailable)}
                                  </span>
                                  <span aria-hidden="true">→</span>
                                </>
                              ) : null}
                              <strong className="tabular-nums">
                                {number.format(event.available)} disponibles
                              </strong>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
                <div className="max-w-sm">
                  <History className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 font-semibold">Aún no hay cambios comparables</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La línea de tiempo aparecerá después de tener al menos una carga registrada para este producto.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
