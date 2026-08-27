"use client";

import {
  ArrowRight,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  aggregateLineMetrics,
  inventorySummary,
} from "@/lib/inventory/analytics";
import { historySnapshotToInventory } from "@/lib/inventory/history";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import {
  countExhaustedReordersWithoutActiveOrder,
  excludeActiveOrderRows,
} from "@/lib/orders/active-orders";
import { cn } from "@/lib/utils";
import type { DashboardPageData } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const longDate = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

function formatSignedInt(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${number.format(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0%";
  const formatted = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
  }).format(Math.abs(rounded));
  return `${rounded > 0 ? "+" : "−"}${formatted}%`;
}

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-bold tabular-nums",
        neutral && "text-muted-foreground",
        !neutral && positive && "text-success",
        !neutral && !positive && "text-destructive",
      )}
    >
      {formatSignedInt(value)}
    </span>
  );
}

function KpiDistribution({
  values,
  tone,
}: {
  values: number[];
  tone: "neutral" | "success" | "destructive" | "warning";
}) {
  const visible = values.slice(0, 7);
  const bars = [...visible, ...Array.from({ length: 7 - visible.length }, () => 0)];
  const maximum = Math.max(1, ...bars);
  const emphasizedIndex = bars.indexOf(Math.max(...bars));

  return (
    <div className="grid h-6 grid-cols-7 items-end gap-1" aria-hidden="true">
      {bars.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className={cn(
            "min-h-1 rounded-[2px]",
            tone === "neutral" &&
              (index === emphasizedIndex ? "bg-primary" : "bg-muted"),
            tone === "success" &&
              (index === emphasizedIndex ? "bg-success" : "bg-success/15"),
            tone === "destructive" &&
              (index === emphasizedIndex
                ? "bg-destructive"
                : "bg-destructive/15"),
            tone === "warning" &&
              (index === emphasizedIndex ? "bg-primary" : "bg-primary/15"),
          )}
          style={{ height: `${Math.max(18, (value / maximum) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardOverview({ data }: { data: DashboardPageData }) {
  const previous = historySnapshotToInventory(data.history, data.current);
  const hasComparison = previous.length > 0;
  const summary = inventorySummary(data.current, data.lowStockThreshold);
  const previousSummary = inventorySummary(previous, data.lowStockThreshold);
  const lines = aggregateLineMetrics(
    data.current,
    previous,
    data.lowStockThreshold,
  );
  const reorderRows = buildReorderAlertRows(
    data.reorderWatchlist.filter((item) => item.active),
    data.current,
  ).filter((item) => item.status !== "healthy");
  const activeOrderSkus = new Set(data.activeOrderSkus);
  const activeReorderCount = reorderRows.filter((item) =>
    activeOrderSkus.has(item.sku),
  ).length;
  const exhaustedWithoutOrder = countExhaustedReordersWithoutActiveOrder(
    reorderRows,
    activeOrderSkus,
  );
  const reorderPriorities = excludeActiveOrderRows(
    reorderRows,
    data.activeOrderSkus,
  )
    .sort(
      (a, b) =>
        (a.hasInventoryRecord ? 0 : 1) - (b.hasInventoryRecord ? 0 : 1) ||
        a.available - b.available ||
        b.suggestedQuantity - a.suggestedQuantity ||
        a.productName.localeCompare(b.productName, "es"),
    )
    .slice(0, 8);
  const latest = data.snapshots[0];
  const latestAgeMinutes = latest
    ? Math.max(
        0,
        Math.round(
          (new Date(data.loadedAt).getTime() -
            new Date(latest.sourceExportedAt).getTime()) /
            60000,
        ),
      )
    : null;
  const inventoryHealth = summary.references
    ? Math.round(
        ((summary.references - summary.exhausted) / summary.references) * 100,
      )
    : 0;

  const decliningLines = lines
    .filter((line) => line.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 4);
  const maxDecline = Math.max(1, ...decliningLines.map((line) => Math.abs(line.change)));

  const availableDeltaPercent =
    hasComparison && previousSummary.available > 0
      ? ((summary.available - previousSummary.available) / previousSummary.available) * 100
      : null;

  const kpis = [
    {
      label: "Referencias activas",
      value: number.format(summary.references),
      detail: `${summary.lines} líneas · ${data.snapshots.length} cargas`,
      delta: hasComparison ? summary.references - previousSummary.references : null,
      accent: null as "destructive" | "warning" | null,
      tone: "neutral" as const,
      distribution: lines.map((line) => line.references),
    },
    {
      label: "Unidades disponibles",
      value: number.format(summary.available),
      detail:
        availableDeltaPercent !== null
          ? `${formatSignedPercent(availableDeltaPercent)} vs carga anterior`
          : "Inventario vigente",
      delta: hasComparison ? summary.available - previousSummary.available : null,
      accent: null,
      tone: "success" as const,
      distribution: lines.map((line) => line.available),
    },
    {
      label: "Agotados",
      value: number.format(summary.exhausted),
      detail: (
        <span className={cn(exhaustedWithoutOrder > 0 && "font-semibold text-destructive")}>
          {exhaustedWithoutOrder} sin pedido activo
        </span>
      ),
      delta: hasComparison ? summary.exhausted - previousSummary.exhausted : null,
      invertDelta: true,
      accent: summary.exhausted ? ("destructive" as const) : null,
      tone: "destructive" as const,
      distribution: lines.map((line) => line.exhausted),
    },
    {
      label: "Inventario bajo",
      value: number.format(summary.lowStock),
      detail: `Umbral ${data.lowStockThreshold} unidades`,
      delta: hasComparison ? summary.lowStock - previousSummary.lowStock : null,
      invertDelta: true,
      accent: summary.lowStock ? ("warning" as const) : null,
      tone: "warning" as const,
      distribution: lines.map((line) => line.lowStock),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inicio"
        subtitle={
          <span className="capitalize">{longDate.format(new Date(data.loadedAt))}</span>
        }
        actions={
          <>
            <div className="flex h-[38px] items-center gap-2 rounded-lg border px-3 text-xs text-muted-foreground">
              <span className="size-[7px] shrink-0 rounded-full bg-success" aria-hidden="true" />
              {latest ? (
                <span>
                  Última carga hace {latestAgeMinutes} min ·{" "}
                  <strong className="font-semibold text-foreground">{latest.filename}</strong>
                </span>
              ) : (
                <span>Sin cargas registradas</span>
              )}
            </div>
            <Button asChild variant="outline">
              <Link href="/analytics">Analítica</Link>
            </Button>
            <Button asChild>
              <Link href="/uploads">
                <RefreshCw data-icon="inline-start" />
                Actualizar inventario
              </Link>
            </Button>
          </>
        }
      />

      <section
        aria-label="Indicadores principales"
        className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className={cn(
              "min-h-[142px] overflow-hidden",
              kpi.accent === "destructive" && "border-l-2 border-l-destructive",
              kpi.accent === "warning" && "border-l-2 border-l-primary",
            )}
          >
            <CardHeader className="pb-1.5">
              <CardDescription className="text-[10px] font-bold uppercase tracking-[0.1em]">
                {kpi.label}
              </CardDescription>
              <div className="flex items-baseline gap-2">
                <CardTitle
                  className={cn(
                    "font-display text-[34px] tabular-nums",
                    kpi.tone === "destructive" && "text-destructive",
                  )}
                >
                  {kpi.value}
                </CardTitle>
                {kpi.delta !== null && (
                  <DeltaBadge value={kpi.delta} invert={kpi.invertDelta} />
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              <KpiDistribution values={kpi.distribution} tone={kpi.tone} />
              <p className="text-xs font-medium text-muted-foreground">
                {kpi.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card data-testid="dashboard-reorder-priorities">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-xl uppercase">
                <ShoppingCart className="size-5 text-primary" aria-hidden="true" />
                Prioridad de recompra
              </CardTitle>
              <CardDescription className="mt-1">
                Sin pedido activo, en el mínimo o ausentes de la última carga.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {reorderPriorities.length > 0 && (
                <Badge variant="secondary">{reorderPriorities.length} pendientes</Badge>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/reorder">
                  Ver recompra
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {reorderPriorities.length > 0 ? (
              <div>
                <div
                  className="hidden border-b bg-table-header px-5 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:grid sm:grid-cols-[28px_minmax(0,1fr)_76px_64px_88px]"
                  aria-hidden="true"
                >
                  <span />
                  <span>Producto</span>
                  <span className="text-right">Disponible</span>
                  <span className="text-right">Mínimo</span>
                  <span className="text-right">Sugerido</span>
                </div>
                <ol className="divide-y divide-row-separator" data-testid="dashboard-reorder-list">
                  {reorderPriorities.map((item, index) => (
                    <li key={item.id}>
                      <Link
                        href={`${item.status === "missing" ? "/reorder" : "/inventory"}?sku=${encodeURIComponent(item.sku)}`}
                        className="grid min-h-[52px] cursor-pointer grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 sm:grid-cols-[28px_minmax(0,1fr)_76px_64px_88px] sm:gap-0 sm:px-5"
                        aria-label={`${index + 1}. ${item.productName}, ${item.hasInventoryRecord ? `${number.format(item.available)} disponibles` : "sin registro en la última carga"}`}
                      >
                        <span className="grid size-6 place-items-center rounded-md bg-primary/16 text-[11px] font-bold tabular-nums">
                          {index + 1}
                        </span>
                        <span className="min-w-0 pr-3">
                          <span className="block truncate text-[13.5px] font-semibold">
                            {item.productName}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            {item.sku}
                            <span
                              className={cn(
                                "font-sans text-[10.5px] font-bold normal-case tracking-normal",
                                item.status === "exhausted" && "text-destructive",
                                item.status === "missing" && "text-muted-foreground",
                                item.status === "low" && "text-warning",
                              )}
                            >
                              · {item.status === "missing"
                                ? "Sin registro"
                                : item.status === "exhausted"
                                  ? "Agotado"
                                  : "Bajo"}
                            </span>
                          </span>
                        </span>
                        <span className="hidden text-right text-[15px] font-bold tabular-nums sm:block">
                          {item.hasInventoryRecord ? number.format(item.available) : "—"}
                        </span>
                        <span className="hidden text-right text-[13px] text-muted-foreground tabular-nums sm:block">
                          {number.format(item.minimumStock)}
                        </span>
                        <span className="hidden text-right text-[15px] font-bold tabular-nums sm:block">
                          {number.format(item.suggestedQuantity)}
                        </span>
                        <span className="col-start-2 row-start-2 flex gap-4 pt-0.5 text-xs text-muted-foreground sm:hidden">
                          <span>
                            Disp.:{" "}
                            <strong className="text-foreground">
                              {item.hasInventoryRecord ? number.format(item.available) : "—"}
                            </strong>
                          </span>
                          <span>
                            Sugerido:{" "}
                            <strong className="text-foreground">
                              {number.format(item.suggestedQuantity)}
                            </strong>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="px-5 pb-2 pt-1">
                <EmptyState
                  icon={PackageCheck}
                  tone="brand"
                  className="py-8"
                  title={
                    activeReorderCount > 0
                      ? "Lo pendiente ya está en pedidos"
                      : "No hay productos por solicitar"
                  }
                  description={
                    activeReorderCount > 0
                      ? `${activeReorderCount} ${activeReorderCount === 1 ? "producto está" : "productos están"} esperando confirmación o llegada.`
                      : "Los productos vigilados están por encima de su mínimo."
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Salud del inventario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-display text-2xl tabular-nums">{inventoryHealth}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.max(0, Math.min(100, inventoryHealth))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {number.format(summary.references - summary.exhausted)} de{" "}
                {number.format(summary.references)} referencias con disponibilidad.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <TrendingDown className="size-3.5 text-destructive" aria-hidden="true" />
                Líneas que ceden
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {decliningLines.length > 0 ? (
                decliningLines.map((line) => (
                  <Link
                    key={line.line}
                    href={`/inventory?line=${encodeURIComponent(line.line)}`}
                    className="block rounded-lg transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate font-medium">{line.line}</span>
                      <span className="shrink-0 font-bold tabular-nums text-destructive">
                        {formatSignedInt(line.change)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-destructive"
                        style={{
                          width: `${Math.max(4, (Math.abs(line.change) / maxDecline) * 100)}%`,
                        }}
                      />
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ninguna línea cede frente a la carga anterior.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Últimas cargas
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.importRuns.slice(0, 3).map((run) => (
                <div key={run.id} className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className={cn(
                      "size-[7px] shrink-0 rounded-full",
                      run.status === "completed" ? "bg-success" : "bg-destructive",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{run.filename}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {dateTime.format(new Date(run.createdAt))}
                  </span>
                </div>
              ))}
              {data.importRuns.length === 0 && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Todavía no hay cargas
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link href="/history">Ver historial</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
