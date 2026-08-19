"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  Clock3,
  PackageCheck,
  PackageX,
  RefreshCw,
  Route,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  aggregateLineMetrics,
  inventorySummary,
} from "@/lib/inventory/analytics";
import { historySnapshotToInventory } from "@/lib/inventory/history";
import { isPriorityProductLine } from "@/lib/inventory/priority-lines";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { excludeActiveOrderRows } from "@/lib/orders/active-orders";
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

export function DashboardOverview({ data }: { data: DashboardPageData }) {
  const previous = historySnapshotToInventory(data.history, data.current);
  const summary = inventorySummary(data.current, data.lowStockThreshold);
  const lines = aggregateLineMetrics(
    data.current,
    previous,
    data.lowStockThreshold,
  );
  const priorityLines = lines.filter((line) =>
    isPriorityProductLine(line.line),
  );
  const reorderRows = buildReorderAlertRows(
    data.reorderWatchlist.filter((item) => item.active),
    data.current,
  ).filter((item) => item.status !== "healthy");
  const activeOrderSkus = new Set(data.activeOrderSkus);
  const activeReorderCount = reorderRows.filter((item) =>
    activeOrderSkus.has(item.sku),
  ).length;
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
    .slice(0, 10);
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

  const kpis = [
    {
      label: "Referencias activas",
      value: number.format(summary.references),
      detail: `${summary.lines} líneas registradas`,
      icon: Boxes,
      tone: "neutral",
    },
    {
      label: "Unidades disponibles",
      value: number.format(summary.available),
      detail: "Inventario vigente",
      icon: PackageCheck,
      tone: "positive",
    },
    {
      label: "Agotados",
      value: number.format(summary.exhausted),
      detail: "Necesitan atención",
      icon: PackageX,
      tone: summary.exhausted ? "critical" : "positive",
    },
    {
      label: "Inventario bajo",
      value: number.format(summary.lowStock),
      detail: `Umbral: ${data.lowStockThreshold} unidades`,
      icon: CircleAlert,
      tone: summary.lowStock ? "warning" : "positive",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="racing-stripe relative overflow-hidden rounded-3xl border bg-secondary p-5 text-secondary-foreground md:p-8">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">
              Mira qué se mueve, qué se agota y qué línea necesita atención.
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/uploads">
                <RefreshCw data-icon="inline-start" />
                Actualizar inventario
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/analytics">
                Ver analítica
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-label="Indicadores principales"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi, index) => (
          <Card
            key={kpi.label}
            className="metric-enter overflow-hidden"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
              <div>
                <CardDescription>{kpi.label}</CardDescription>
                <CardTitle className="mt-2 font-display text-4xl tabular-nums">
                  {kpi.value}
                </CardTitle>
              </div>
              <div
                className={cn(
                  "grid size-10 place-items-center rounded-xl bg-muted",
                  kpi.tone === "positive" && "bg-primary/15 text-foreground",
                  kpi.tone === "critical" &&
                    "bg-destructive/10 text-destructive",
                  kpi.tone === "warning" && "bg-primary/20 text-foreground",
                )}
              >
                <kpi.icon className="size-5" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground">
                {kpi.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card data-testid="dashboard-reorder-priorities">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-2xl uppercase">
              <ShoppingCart className="size-5 text-primary" aria-hidden="true" />
              Prioridad de recompra
            </CardTitle>
            <CardDescription className="mt-1">
              Productos en el mínimo o ausentes de la última carga, sin pedidos activos.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/reorder">
              Ver recompra
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {reorderPriorities.length > 0 ? (
            <ol className="grid gap-2" data-testid="dashboard-reorder-list">
              {reorderPriorities.map((item, index) => (
                <li key={item.id}>
                  <Link
                    href={`${item.status === "missing" ? "/reorder" : "/inventory"}?sku=${encodeURIComponent(item.sku)}`}
                    className="grid min-h-16 cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 transition-colors hover:border-primary/60 hover:bg-muted/40 md:grid-cols-[2rem_minmax(0,1fr)_minmax(8rem,0.5fr)_6rem_6rem_auto] md:px-4"
                    aria-label={`${index + 1}. ${item.productName}, ${item.hasInventoryRecord ? `${number.format(item.available)} disponibles` : "sin registro en la última carga"}`}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-sm font-bold tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {item.productName}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        SKU: {item.sku}
                      </span>
                    </span>
                    <Badge
                      variant={item.status === "exhausted" ? "destructive" : item.status === "missing" ? "outline" : "default"}
                      className="justify-self-end md:order-last"
                    >
                      {item.status === "missing"
                        ? "Sin registro"
                        : item.status === "exhausted"
                          ? "Agotado"
                          : "Por solicitar"}
                    </Badge>
                    <span className="hidden truncate text-sm text-muted-foreground md:block">
                      {item.productLine ?? "Sin línea"}
                    </span>
                    <span className="hidden text-right md:block">
                      <span className="block text-[0.68rem] uppercase text-muted-foreground">
                        Disponible
                      </span>
                      <span className="mt-1 block font-bold tabular-nums">
                        {item.hasInventoryRecord ? number.format(item.available) : "—"}
                      </span>
                    </span>
                    <span className="hidden text-right md:block">
                      <span className="block text-[0.68rem] uppercase text-muted-foreground">
                        Mínimo
                      </span>
                      <span className="mt-1 block font-bold tabular-nums">
                        {number.format(item.minimumStock)}
                      </span>
                    </span>
                    <span className="col-start-2 flex gap-4 text-xs text-muted-foreground md:hidden">
                      <span>
                        Disponible:{" "}
                        <strong className="text-foreground">
                          {item.hasInventoryRecord ? number.format(item.available) : "—"}
                        </strong>
                      </span>
                      <span>
                        Mínimo:{" "}
                        <strong className="text-foreground">
                          {number.format(item.minimumStock)}
                        </strong>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid min-h-32 place-items-center rounded-xl border border-dashed p-6 text-center">
              <div>
                <PackageCheck
                  className="mx-auto size-8 text-primary"
                  aria-hidden="true"
                />
                <p className="mt-3 font-semibold">
                  {activeReorderCount > 0
                    ? "Lo pendiente ya está en pedidos"
                    : "No hay productos por solicitar"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeReorderCount > 0
                    ? `${activeReorderCount} ${activeReorderCount === 1 ? "producto está" : "productos están"} esperando confirmación o llegada.`
                    : "Los productos vigilados están por encima de su mínimo."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display text-2xl uppercase">
                Líneas principales
              </CardTitle>
              <CardDescription>
                Acceso directo a las líneas prioritarias.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/lines">
                Ver detalle
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {priorityLines.map((line) => (
              <Link
                key={line.line}
                href={`/inventory?line=${encodeURIComponent(line.line)}`}
                className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:border-primary/60 hover:bg-muted/40"
              >
                <div>
                  <p className="font-semibold">{line.line}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {line.references} referencias · {line.exhausted} agotadas ·{" "}
                    {line.lowStock} bajas
                  </p>
                </div>
                <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl uppercase">
              Estado operativo
            </CardTitle>
            <CardDescription>
              Lo importante para decidir rápido.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Salud del inventario</span>
                <span className="font-bold tabular-nums">{inventoryHealth}%</span>
              </div>
              <Progress value={inventoryHealth} className="h-2.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                Referencias con disponibilidad mayor a cero.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-xl border bg-muted/35 p-3">
                <Clock3 className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Última actualización</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latest
                      ? dateTime.format(new Date(latest.sourceExportedAt))
                      : "Todavía no hay cargas"}
                  </p>
                  {latestAgeMinutes !== null && (
                    <p className="mt-1 text-xs font-medium">
                      Hace {latestAgeMinutes} minutos
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border bg-muted/35 p-3">
                <Route className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">
                    Mayor movimiento negativo
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {priorityLines
                      .slice()
                      .sort((a, b) => a.change - b.change)[0]?.line ??
                      "Sin comparación"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl uppercase">
              <TrendingDown className="size-5 text-destructive" />
              Líneas que requieren atención
            </CardTitle>
            <CardDescription>
              Variación frente a la carga comparable anterior.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {priorityLines
              .slice()
              .sort((a, b) => a.change - b.change)
              .slice(0, 4)
              .map((line) => (
                <Link
                  key={line.line}
                  href={`/inventory?line=${encodeURIComponent(line.line)}`}
                  className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-semibold">{line.line}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {line.exhausted} agotados · {line.lowStock} bajos
                    </p>
                  </div>
                  <Badge
                    variant={line.change < 0 ? "destructive" : "secondary"}
                    className="gap-1 tabular-nums"
                  >
                    {line.change < 0 ? <ArrowDownRight /> : <ArrowUpRight />}
                    {number.format(line.change)}
                  </Badge>
                </Link>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
              Últimas cargas
            </CardTitle>
            <CardDescription>
              Resultado y responsable de cada actualización.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.importRuns.slice(0, 4).map((run) => (
              <div
                key={run.id}
                className="flex min-h-14 items-center justify-between gap-4 rounded-xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{run.filename}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Usuario autorizado · {dateTime.format(new Date(run.createdAt))}
                  </p>
                </div>
                <Badge
                  variant={run.status === "completed" ? "default" : "destructive"}
                >
                  {run.status === "completed" ? "Lista" : "Falló"}
                </Badge>
              </div>
            ))}
            <Button asChild variant="outline">
              <Link href="/history">Ver historial completo</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
