"use client";

import {
  ArrowDownRight,
  ChartNoAxesCombined,
  PackageMinus,
  Shapes,
  TrendingDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
  calculateProductMovements,
  summarizeNegativeMovementsByLine,
} from "@/lib/inventory/analytics";
import { historySnapshotToInventory } from "@/lib/inventory/history";
import {
  isPriorityProductLine,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import type { InventoryHistoryPoint, InventoryItem } from "@/types/inventory";

const chartColors = [
  "hsl(var(--destructive))",
  "var(--chart-4)",
  "var(--chart-1)",
  "var(--chart-3)",
  "hsl(var(--muted-foreground))",
];

const movementConfig = {
  unitsOut: { label: "Unidades que salieron", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

const lineConfig = {
  unitsOut: { label: "Unidades que salieron", color: "hsl(var(--destructive))" },
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

export function AnalyticsDashboard({
  current,
  history,
}: {
  current: InventoryItem[];
  history: InventoryHistoryPoint[];
}) {
  const router = useRouter();
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

  const availablePriorityLines = PRIORITY_PRODUCT_LINES.filter((item) =>
    current.some((currentItem) => currentItem.productLine === item),
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
      label: item.sku,
      unitsOut: Math.abs(item.change),
    }));
    const lineBreakdown = compactLineBreakdown(
      summarizeNegativeMovementsByLine(negativeMovements),
    );

    return {
      comparisonAvailable: comparisonItems.length > 0,
      negativeMovements,
      movementChart,
      lineBreakdown,
      totalUnitsOut: negativeMovements.reduce(
        (sum, item) => sum + Math.abs(item.change),
        0,
      ),
    };
  }, [comparison, current, fromDate, history, line, toDate]);

  const largestDrop = analytics.negativeMovements[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Movimiento entre cargas"
        title="Productos que bajaron de inventario"
        description="Concéntrate en las referencias cuya existencia disminuyó frente a la carga anterior. Una reducción representa movimiento de inventario, no necesariamente una venta."
        icon={ChartNoAxesCombined}
      />

      <Card className="overflow-hidden border-destructive/20 bg-gradient-to-br from-card via-card to-destructive/[0.04]">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1fr)] lg:p-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="analytics-line">Línea de producto</Label>
            <Select value={line} onValueChange={setLine}>
              <SelectTrigger id="analytics-line" className="h-11 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Prioridad</SelectLabel>
                  <SelectItem value="priority">Líneas principales</SelectItem>
                  {availablePriorityLines.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                  <SelectItem value="all">Todas las líneas</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Comparación</Label>
            <Tabs value={comparison} onValueChange={setComparison}>
              <TabsList className="grid h-[3.25rem] w-full grid-cols-2">
                <TabsTrigger value="previous">Carga anterior</TabsTrigger>
                <TabsTrigger value="range">Entre fechas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {comparison === "range" ? (
            <div className="grid gap-4 rounded-xl border bg-background/80 p-4 sm:grid-cols-2 lg:col-span-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="from-date">Fecha inicial</Label>
                <Input
                  id="from-date"
                  type="date"
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
                  value={toDate}
                  min={fromDate}
                  max={defaultTo}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen de disminuciones">
        <Card className="border-destructive/20">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <PackageMinus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Unidades que salieron</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatNumber(analytics.totalUnitsOut)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary-foreground dark:text-primary">
              <Shapes className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Productos afectados</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {formatNumber(analytics.negativeMovements.length)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <TrendingDown className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Mayor disminución</p>
              <p className="truncate font-display text-2xl font-bold tabular-nums">
                {largestDrop ? `${largestDrop.change} · ${largestDrop.sku}` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Referencias con mayor disminución
          </CardTitle>
          <CardDescription>
            Solo aparecen productos con cambio negativo. Selecciona una barra o una fila para abrir el detalle del SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {analytics.movementChart.length > 0 ? (
            <>
              <ChartContainer
                config={movementConfig}
                className="h-[420px] min-h-[420px] w-full"
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
                    width={86}
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.55)" }}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="unitsOut"
                    fill="hsl(var(--destructive))"
                    radius={[0, 7, 7, 0]}
                    className="cursor-pointer"
                    onClick={(entry: { sku?: string }) => {
                      if (entry.sku) {
                        router.push(`/inventory?sku=${encodeURIComponent(entry.sku)}`);
                      }
                    }}
                  />
                </BarChart>
              </ChartContainer>

              <div className="data-list grid gap-3 md:grid-cols-2">
                {analytics.movementChart.slice(0, 8).map((item) => (
                  <button
                    key={`${item.sku}-${item.warehouse}`}
                    type="button"
                    onClick={() =>
                      router.push(`/inventory?sku=${encodeURIComponent(item.sku)}`)
                    }
                    className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors duration-200 hover:border-destructive/35 hover:bg-destructive/[0.04]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-muted-foreground">
                        {item.sku} · {item.productLine}
                      </p>
                      <p className="mt-1 line-clamp-2 font-semibold">{item.productName}</p>
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

      {analytics.lineBreakdown.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl uppercase">
              ¿Dónde se concentró la disminución?
            </CardTitle>
            <CardDescription>
              Participación de cada línea en las unidades que salieron. Las líneas menores se agrupan para mantener la lectura clara.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(300px,0.8fr)_minmax(280px,1fr)]">
            <ChartContainer
              config={lineConfig}
              className="mx-auto h-[320px] min-h-[320px] min-w-0 w-full max-w-md"
              role="img"
              aria-label={`Distribución de ${formatNumber(analytics.totalUnitsOut)} unidades que salieron entre ${analytics.lineBreakdown.length} grupos de líneas.`}
            >
              <PieChart accessibilityLayer>
                <ChartTooltip content={<ChartTooltipContent nameKey="line" />} />
                <Pie
                  data={analytics.lineBreakdown}
                  dataKey="unitsOut"
                  nameKey="line"
                  innerRadius={62}
                  outerRadius={104}
                  paddingAngle={2}
                  strokeWidth={2}
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

            <div className="divide-y rounded-xl border" role="list" aria-label="Detalle por línea">
              {analytics.lineBreakdown.map((item, index) => (
                <div
                  key={item.line}
                  role="listitem"
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.line}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(item.products)} {item.products === 1 ? "producto" : "productos"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-mono font-bold tabular-nums text-destructive">
                    −{formatNumber(item.unitsOut)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
