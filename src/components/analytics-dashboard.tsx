"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
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
  buildLineTrend,
  calculateProductMovements,
} from "@/lib/inventory/analytics";
import { historySnapshotToInventory } from "@/lib/inventory/history";
import {
  isPriorityProductLine,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import type { InventoryItem } from "@/types/inventory";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "hsl(var(--muted-foreground))",
];

function inventoryAtDate(
  date: string,
  current: InventoryItem[],
  history: ReturnType<typeof useInventoryData>["history"],
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

export function AnalyticsDashboard() {
  const router = useRouter();
  const data = useInventoryData();
  const [days, setDays] = useState("90");
  const [line, setLine] = useState("priority");
  const [comparison, setComparison] = useState("previous");
  const defaultTo =
    data.current[0]?.sourceExportedAt.slice(0, 10) ??
    data.history.at(-1)?.date.slice(0, 10) ??
    "2026-01-01";
  const defaultFrom = new Date(
    new Date(`${defaultTo}T12:00:00`).getTime() - 30 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const availablePriorityLines = PRIORITY_PRODUCT_LINES.filter((item) =>
    data.current.some((current) => current.productLine === item),
  );
  const lineMatches = (productLine: string) =>
    line === "all" ||
    (line === "priority" && isPriorityProductLine(productLine)) ||
    productLine === line;

  const trend = useMemo(() => {
    const history =
      line === "priority"
        ? data.history.filter((point) =>
            isPriorityProductLine(point.productLine),
          )
        : data.history;
    return buildLineTrend(
      history,
      Number(days),
      line === "priority" ? "all" : line,
      "all",
    );
  }, [data.history, days, line]);

  const comparisonItems =
    comparison === "range"
      ? inventoryAtDate(fromDate, data.current, data.history)
      : historySnapshotToInventory(data.history, data.current);
  const endItems =
    comparison === "range"
      ? inventoryAtDate(toDate, data.current, data.history)
      : data.current;
  const movements = calculateProductMovements(endItems, comparisonItems)
    .filter((item) => lineMatches(item.productLine));
  const movementChart = movements
    .slice()
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10)
    .map((item) => ({ ...item, label: item.sku }));

  const trendConfig = Object.fromEntries(
    trend.lines.map((name, index) => [
      name,
      { label: name, color: chartColors[index % chartColors.length] },
    ]),
  ) satisfies ChartConfig;
  const movementConfig = {
    change: { label: "Cambio de unidades", color: "hsl(var(--chart-1))" },
  } satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Comparación por fecha"
        title="Analítica de líneas principales"
        description="Encuentra los productos que más cambiaron y compara su inventario entre cargas."
        icon={ChartNoAxesCombined}
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[auto_minmax(180px,1fr)]">
            <div className="flex flex-col gap-2">
              <Label>Periodo</Label>
              <Tabs value={days} onValueChange={setDays}>
                <TabsList className="grid h-11 grid-cols-3">
                  <TabsTrigger value="7">7 días</TabsTrigger>
                  <TabsTrigger value="30">30 días</TabsTrigger>
                  <TabsTrigger value="90">90 días</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="analytics-line">Línea</Label>
              <Select value={line} onValueChange={setLine}>
                <SelectTrigger id="analytics-line" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Prioridad</SelectLabel>
                    <SelectItem value="priority">
                      Líneas principales
                    </SelectItem>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="font-display text-2xl uppercase">
                Productos con mayor movimiento
              </CardTitle>
              <CardDescription>
                Comparación de unidades disponibles por SKU.
              </CardDescription>
            </div>
            <Tabs value={comparison} onValueChange={setComparison}>
              <TabsList>
                <TabsTrigger value="previous">Carga anterior</TabsTrigger>
                <TabsTrigger value="range">Entre fechas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {comparison === "range" && (
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
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
          )}

          {movementChart.length > 0 ? (
            <>
              <ChartContainer
                config={movementConfig}
                className="min-h-[340px] w-full"
                role="img"
                aria-label="Productos con mayor cambio de inventario"
              >
                <BarChart accessibilityLayer data={movementChart}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={52} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="change"
                    radius={[6, 6, 0, 0]}
                    className="cursor-pointer"
                    onClick={(entry: { sku?: string }) => {
                      if (entry.sku) {
                        router.push(
                          `/inventory?sku=${encodeURIComponent(entry.sku)}`,
                        );
                      }
                    }}
                  >
                    {movementChart.map((entry) => (
                      <Cell
                        key={`${entry.sku}-${entry.warehouse}`}
                        fill={
                          entry.change < 0
                            ? "hsl(var(--destructive))"
                            : "hsl(var(--chart-2))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>

              <div className="grid gap-3 md:grid-cols-2">
                {movementChart.slice(0, 8).map((item) => (
                  <button
                    key={`${item.sku}-${item.warehouse}`}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/inventory?sku=${encodeURIComponent(item.sku)}`,
                      )
                    }
                    className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors hover:bg-muted/45"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-muted-foreground">
                        {item.sku} · {item.productLine}
                      </p>
                      <p className="mt-1 line-clamp-2 font-semibold">
                        {item.productName}
                      </p>
                    </div>
                    <Badge
                      variant={item.change < 0 ? "destructive" : "secondary"}
                      className="shrink-0 gap-1 tabular-nums"
                    >
                      {item.change < 0 ? <ArrowDownRight /> : <ArrowUpRight />}
                      {item.change > 0 ? "+" : ""}
                      {item.change}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Se necesita otra carga comparable para mostrar cambios.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Evolución de líneas
          </CardTitle>
          <CardDescription>
            Inventario disponible durante el periodo seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={trendConfig}
            className="min-h-[360px] w-full"
            role="img"
            aria-label="Evolución del inventario de las líneas seleccionadas"
          >
            <LineChart accessibilityLayer data={trend.data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) =>
                  new Intl.DateTimeFormat("es-CO", {
                    day: "2-digit",
                    month: "short",
                  }).format(new Date(`${value}T12:00:00`))
                }
              />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              {trend.lines.slice(0, 6).map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
