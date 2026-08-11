"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChartNoAxesCombined,
  Layers3,
  ListFilter,
  PackageMinus,
  RotateCcw,
  Shapes,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { ProductHistorySheet } from "@/components/product-history-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildInventoryTrend,
  calculateProductMovements,
  summarizeNegativeMovementsByLine,
} from "@/lib/inventory/analytics";
import { historySnapshotToInventory } from "@/lib/inventory/history";
import {
  compareProductLines,
  isPriorityProductLine,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import type { InventoryHistoryPoint, InventoryItem } from "@/types/inventory";

const chartColors = [
  "hsl(var(--destructive))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-3))",
  "hsl(var(--muted-foreground))",
];

const movementConfig = {
  unitsOut: { label: "Unidades que salieron", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

const lineConfig = {
  unitsOut: { label: "Unidades que salieron", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

const trendConfig = {
  available: { label: "Unidades disponibles", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

function inventoryAtDate(
  date: string,
  current: InventoryItem[],
  history: InventoryHistoryPoint[],
) {
  const target = new Date(`${date}T23:59:59`);
  const eligibleDates = [...new Set(history.map((point) => point.date))]
    .filter((item) => new Date(item) <= target)
    .sort();
  const selected = eligibleDates.at(-1);
  return selected
    ? historySnapshotToInventory(history, current, selected)
    : historySnapshotToInventory(history, current);
}

function compactLineBreakdown(
  rows: ReturnType<typeof summarizeNegativeMovementsByLine>,
) {
  if (rows.length <= 5) return rows;
  const visible = rows.slice(0, 4);
  const rest = rows.slice(4);
  return [
    ...visible,
    {
      line: "Otras líneas",
      unitsOut: rest.reduce((sum, row) => sum + row.unitsOut, 0),
      products: rest.reduce((sum, row) => sum + row.products, 0),
    },
  ];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function shortenProductName(value: string, maxLength = 22) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function MovementTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      productLine?: string;
      productName?: string;
      sku?: string;
      unitsOut?: number;
    };
  }>;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="grid max-w-72 gap-2 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-xl">
      <div>
        <p className="font-mono text-xs font-bold text-muted-foreground">
          {item.sku} · {item.productLine}
        </p>
        <p className="mt-1 font-semibold leading-snug">{item.productName}</p>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-2">
        <span className="text-xs text-muted-foreground">Unidades que salieron</span>
        <span className="font-mono font-bold tabular-nums text-destructive">
          −{formatNumber(item.unitsOut ?? 0)}
        </span>
      </div>
    </div>
  );
}

export function AnalyticsDashboard({
  current,
  history,
}: {
  current: InventoryItem[];
  history: InventoryHistoryPoint[];
}) {
  const [line, setLine] = useState(() =>
    current.some((item) => isPriorityProductLine(item.productLine))
      ? "priority"
      : "all",
  );
  const [comparison, setComparison] = useState("previous");
  const defaultTo =
    current[0]?.sourceExportedAt.slice(0, 10) ??
    history.at(-1)?.date.slice(0, 10) ??
    "2026-01-01";
  const defaultFrom = new Date(
    new Date(`${defaultTo}T12:00:00`).getTime() - 30 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const availableLines = [...new Set(current.map((item) => item.productLine))]
    .sort(compareProductLines);
  const availablePriorityLines = PRIORITY_PRODUCT_LINES.filter((item) =>
    current.some((currentItem) => currentItem.productLine === item),
  );
  const availableOtherLines = availableLines.filter(
    (item) => !isPriorityProductLine(item),
  );

  const analytics = useMemo(() => {
    const comparisonItems =
      comparison === "range"
        ? inventoryAtDate(fromDate, current, history)
        : historySnapshotToInventory(history, current);
    const endItems =
      comparison === "range"
        ? inventoryAtDate(toDate, current, history)
        : current;
    const negativeMovements = calculateProductMovements(
      endItems,
      comparisonItems,
    )
      .filter(
        (item) =>
          item.change < 0 &&
          (line === "all" ||
            (line === "priority" && isPriorityProductLine(item.productLine)) ||
            item.productLine === line),
      )
      .sort((a, b) => a.change - b.change);

    const movementChart = negativeMovements.slice(0, 12).map((item) => ({
      ...item,
      label: shortenProductName(item.productName),
      unitsOut: Math.abs(item.change),
    }));
    const lineBreakdown = compactLineBreakdown(
      summarizeNegativeMovementsByLine(negativeMovements),
    );
    const selectedProductLines =
      line === "all"
        ? undefined
        : line === "priority"
          ? PRIORITY_PRODUCT_LINES
          : [line];
    const inventoryTrend = buildInventoryTrend(
      history,
      current,
      selectedProductLines,
    ).map((point) => ({
      ...point,
      label: formatShortDate(point.date),
    }));

    return {
      comparisonAvailable: comparisonItems.length > 0,
      negativeMovements,
      movementChart,
      lineBreakdown,
      inventoryTrend,
      totalUnitsOut: negativeMovements.reduce(
        (sum, item) => sum + Math.abs(item.change),
        0,
      ),
    };
  }, [comparison, current, fromDate, history, line, toDate]);

  const largestDrop = analytics.negativeMovements[0];
  const averageUnitsOut = analytics.negativeMovements.length
    ? Math.round(analytics.totalUnitsOut / analytics.negativeMovements.length)
    : 0;
  const firstTrendPoint = analytics.inventoryTrend[0];
  const lastTrendPoint = analytics.inventoryTrend.at(-1);
  const firstTrendLabel = firstTrendPoint
    ? formatShortDate(firstTrendPoint.date)
    : "";
  const lastTrendLabel = lastTrendPoint
    ? formatShortDate(lastTrendPoint.date)
    : "";
  const trendChange =
    firstTrendPoint && lastTrendPoint
      ? lastTrendPoint.available - firstTrendPoint.available
      : 0;
  const selectedLineLabel =
    line === "priority"
      ? "Líneas principales"
      : line === "all"
        ? "Todas las líneas"
        : line;
  const comparisonLabel =
    comparison === "previous"
      ? "Última carga vs. carga anterior"
      : `${formatShortDate(fromDate)} – ${formatShortDate(toDate)}`;
  const hasCustomFilters =
    line !== (availablePriorityLines.length > 0 ? "priority" : "all") ||
    comparison !== "previous";

  function resetFilters() {
    setLine(availablePriorityLines.length > 0 ? "priority" : "all");
    setComparison("previous");
    setFromDate(defaultFrom);
    setToDate(defaultTo);
  }

  function openProductHistory(sku: string, warehouse: string) {
    const item = current.find(
      (currentItem) =>
        currentItem.sku === sku && currentItem.warehouse === warehouse,
    );
    if (item) setHistoryItem(item);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Decisiones con datos"
        title="Analíticas de inventario"
        description="Entiende la tendencia general, detecta dónde se concentra la salida de unidades y abre el detalle de cada referencia. Los movimientos representan cambios de inventario, no necesariamente ventas."
        icon={ChartNoAxesCombined}
      />

      <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.06]">
        <CardHeader className="gap-3 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-foreground dark:text-primary">
                <ListFilter className="size-4" aria-hidden="true" />
                Ajusta el análisis
              </div>
              <CardTitle className="font-display text-xl uppercase sm:text-2xl">
                ¿Qué quieres revisar?
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Elige una línea y el periodo. Todas las métricas y gráficas se actualizarán juntas.
              </CardDescription>
            </div>
            {hasCustomFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0 gap-2 self-start"
                onClick={resetFilters}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Restablecer
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(340px,1.2fr)]">
          <div className="flex flex-col gap-2 rounded-xl border bg-background/75 p-3.5">
            <Label htmlFor="analytics-line" className="flex items-center gap-2">
              <Layers3 className="size-4 text-muted-foreground" aria-hidden="true" />
              1. Línea de producto
            </Label>
            <Select value={line} onValueChange={setLine}>
              <SelectTrigger id="analytics-line" className="h-12 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Vista rápida</SelectLabel>
                  <SelectItem value="priority">Todas las líneas principales</SelectItem>
                  <SelectItem value="all">Todo el inventario</SelectItem>
                </SelectGroup>
                {availablePriorityLines.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Líneas principales</SelectLabel>
                    {availablePriorityLines.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {availableOtherLines.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Otras líneas</SelectLabel>
                    {availableOtherLines.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border bg-background/75 p-3.5">
            <Label className="flex items-center gap-2">
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
              2. Periodo de comparación
            </Label>
            <Tabs value={comparison} onValueChange={setComparison}>
              <TabsList className="grid h-12 w-full grid-cols-2">
                <TabsTrigger value="previous">Últimas cargas</TabsTrigger>
                <TabsTrigger value="range">Elegir fechas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {comparison === "range" ? (
            <div className="grid gap-4 rounded-xl border border-primary/20 bg-background/80 p-4 sm:grid-cols-2 lg:col-span-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="from-date">Fecha inicial</Label>
                <Input
                  id="from-date"
                  type="date"
                  className="h-12"
                  value={fromDate}
                  max={toDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="to-date">Fecha final</Label>
                <Input
                  id="to-date"
                  type="date"
                  className="h-12"
                  value={toDate}
                  min={fromDate}
                  max={defaultTo}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground lg:col-span-2">
            <span className="font-semibold">Viendo:</span>
            <span>{selectedLineLabel}</span>
            <span className="text-secondary-foreground/45" aria-hidden="true">•</span>
            <span>{comparisonLabel}</span>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del análisis">
        <Card className="border-destructive/20">
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <PackageMinus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Salida detectada</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatNumber(analytics.totalUnitsOut)}
              </p>
              <p className="text-xs text-muted-foreground">unidades</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary-foreground dark:text-primary">
              <Shapes className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Referencias</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatNumber(analytics.negativeMovements.length)}
              </p>
              <p className="text-xs text-muted-foreground">con disminución</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <ArrowDownRight className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Promedio</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatNumber(averageUnitsOut)}
              </p>
              <p className="text-xs text-muted-foreground">por referencia</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <TrendingDown className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mayor caída</p>
              <p className="truncate font-display text-2xl font-bold tabular-nums text-destructive">
                {largestDrop ? formatNumber(largestDrop.change) : "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {largestDrop?.sku ?? "Sin cambios"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="analytics-overview-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Vista general
            </p>
            <h2 id="analytics-overview-title" className="font-display text-2xl font-bold uppercase">
              ¿Qué está pasando con el inventario?
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">Historial disponible de los últimos 90 días</p>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b bg-muted/15 pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>
                    <h3 className="font-display text-xl uppercase sm:text-2xl">
                      Evolución de existencias
                    </h3>
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Total de unidades disponibles en cada carga para {selectedLineLabel.toLocaleLowerCase("es")}.
                  </CardDescription>
                </div>
                {analytics.inventoryTrend.length > 1 ? (
                  <Badge
                    variant="outline"
                    className={
                      trendChange < 0
                        ? "gap-1.5 border-destructive/30 bg-destructive/5 text-destructive"
                        : "gap-1.5 border-primary/35 bg-primary/10 text-foreground"
                    }
                  >
                    {trendChange < 0 ? (
                      <ArrowDownRight className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    )}
                    {trendChange > 0 ? "+" : ""}{formatNumber(trendChange)} unidades
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-5 sm:pt-6">
              {analytics.inventoryTrend.length > 1 ? (
                <>
                  <ChartContainer
                    config={trendConfig}
                    className="h-[280px] min-h-[280px] w-full sm:h-[330px] sm:min-h-[330px]"
                    role="img"
                    aria-label={`Tendencia de inventario entre ${firstTrendLabel} y ${lastTrendLabel}; cambio de ${formatNumber(trendChange)} unidades.`}
                  >
                    <LineChart
                      accessibilityLayer
                      data={analytics.inventoryTrend}
                      margin={{ left: 4, right: 16, top: 12, bottom: 4 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                        tickMargin={10}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={formatNumber}
                        width={58}
                      />
                      <ChartTooltip
                        cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Line
                        type="monotone"
                        dataKey="available"
                        stroke="var(--color-available)"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "var(--color-available)", strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                  <div className="mt-4 flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary-foreground dark:text-primary">
                      <ChartNoAxesCombined className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold">Lectura rápida</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        Las existencias {trendChange < 0 ? "bajaron" : trendChange > 0 ? "subieron" : "se mantuvieron"} en {formatNumber(Math.abs(trendChange))} unidades entre la primera y la última carga visibles.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                  <div className="max-w-sm">
                    <ChartNoAxesCombined className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="font-semibold">Faltan cargas para mostrar una tendencia</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      La gráfica aparecerá cuando existan al menos dos cargas comparables.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b bg-muted/15 pb-5">
              <CardTitle>
                <h3 className="font-display text-xl uppercase sm:text-2xl">
                  Salida por línea
                </h3>
              </CardTitle>
              <CardDescription>
                Dónde se concentraron las unidades que disminuyeron en la comparación elegida.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 sm:pt-6">
              {analytics.lineBreakdown.length > 0 ? (
                <>
                  <div className="relative mx-auto max-w-sm">
                    <ChartContainer
                      config={lineConfig}
                      className="h-[230px] min-h-[230px] w-full"
                      role="img"
                      aria-label={`Distribución de ${formatNumber(analytics.totalUnitsOut)} unidades entre ${analytics.lineBreakdown.length} grupos de líneas.`}
                    >
                      <PieChart accessibilityLayer>
                        <ChartTooltip content={<ChartTooltipContent nameKey="line" />} />
                        <Pie
                          data={analytics.lineBreakdown}
                          dataKey="unitsOut"
                          nameKey="line"
                          innerRadius={66}
                          outerRadius={96}
                          paddingAngle={3}
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {analytics.lineBreakdown.map((entry, index) => (
                            <Cell
                              key={entry.line}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-content-center text-center" aria-hidden="true">
                      <span className="font-display text-2xl font-bold tabular-nums">
                        {formatNumber(analytics.totalUnitsOut)}
                      </span>
                      <span className="text-xs text-muted-foreground">unidades</span>
                    </div>
                  </div>

                  <div className="mt-2 divide-y rounded-xl border" role="list" aria-label="Detalle por línea">
                    {analytics.lineBreakdown.map((item, index) => (
                      <div key={item.line} role="listitem" className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: chartColors[index % chartColors.length] }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.line}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(item.products)} {item.products === 1 ? "producto" : "productos"}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-destructive">
                          −{formatNumber(item.unitsOut)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                  <div>
                    <Shapes className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="font-semibold">Sin disminuciones por línea</p>
                    <p className="mt-1 text-sm text-muted-foreground">Cambia la línea o el periodo para explorar otra comparación.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/15 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>
                <h2 className="font-display text-2xl uppercase">
                  ¿Qué productos tuvieron mayor salida?
                </h2>
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                El nombre del producto aparece a la izquierda de cada barra. Pasa el cursor para verlo completo o toca una barra o tarjeta para abrir su historial.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="self-start tabular-nums">
              Top {analytics.movementChart.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-5 sm:pt-6">
          {analytics.movementChart.length > 0 ? (
            <>
              <ChartContainer
                config={movementConfig}
                className="h-[360px] min-h-[360px] w-full sm:h-[420px] sm:min-h-[420px]"
                role="img"
                aria-label={`Ranking de ${analytics.movementChart.length} productos con disminución de inventario; ${formatNumber(analytics.totalUnitsOut)} unidades salieron en total.`}
              >
                <BarChart
                  accessibilityLayer
                  data={analytics.movementChart}
                  layout="vertical"
                  margin={{ left: 4, right: 28 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    tickMargin={8}
                    width={152}
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.55)" }}
                    content={<MovementTooltipContent />}
                  />
                  <Bar
                    dataKey="unitsOut"
                    fill="hsl(var(--destructive))"
                    radius={[0, 7, 7, 0]}
                    className="cursor-pointer"
                    onClick={(entry: { sku?: string; warehouse?: string }) => {
                      if (entry.sku && entry.warehouse) {
                        openProductHistory(entry.sku, entry.warehouse);
                      }
                    }}
                  />
                </BarChart>
              </ChartContainer>

              <div className="data-list grid gap-3 md:grid-cols-2">
                {analytics.movementChart.slice(0, 8).map((item, index) => (
                  <button
                    key={`${item.sku}-${item.warehouse}`}
                    type="button"
                    onClick={() => openProductHistory(item.sku, item.warehouse)}
                    className="group flex min-h-20 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors duration-200 hover:border-destructive/35 hover:bg-destructive/[0.04] sm:p-4"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs font-bold text-muted-foreground transition-colors group-hover:bg-destructive/10 group-hover:text-destructive">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-bold text-muted-foreground">
                        {item.sku} · {item.productLine}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold sm:text-base">{item.productName}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 gap-1 tabular-nums">
                      <ArrowDownRight className="size-3.5" aria-hidden="true" />
                      {item.change}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
              <div className="max-w-md">
                <TrendingDown className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
                <p className="font-semibold">
                  {analytics.comparisonAvailable
                    ? "No hubo disminuciones en esta comparación"
                    : "Aún no existe una carga anterior comparable"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {analytics.comparisonAvailable
                    ? "Prueba otra línea o cambia el rango de fechas."
                    : "Cuando publiques una nueva carga, aquí verás los productos que bajaron."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductHistorySheet
        item={historyItem}
        open={Boolean(historyItem)}
        onOpenChange={(open) => {
          if (!open) setHistoryItem(null);
        }}
      />
    </div>
  );
}
