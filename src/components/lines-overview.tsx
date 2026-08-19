"use client";

import {
  ArrowRight,
  CircleAlert,
  History,
  Layers3,
  PackageCheck,
  PackageX,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ProductHistorySheet } from "@/components/product-history-sheet";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getStockLevel,
  PRIORITY_PRODUCT_LINES,
  type StockLevel,
} from "@/lib/inventory/priority-lines";
import { getReorderPointForLine } from "@/lib/inventory/reorder";
import { cn } from "@/lib/utils";
import type { ProductHistorySubject } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

const levelMeta: Record<
  StockLevel,
  { label: string; className: string; dot: string; order: number }
> = {
  exhausted: {
    label: "Agotado",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    order: 0,
  },
  low: {
    label: "Bajo",
    className: "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
    order: 1,
  },
  medium: {
    label: "Medio",
    className: "border-primary/40 bg-primary/10 text-foreground",
    dot: "bg-primary",
    order: 2,
  },
  high: {
    label: "Alto",
    className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    order: 3,
  },
};

function LevelBadge({ level }: { level: StockLevel }) {
  const meta = levelMeta[level];
  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.className)}>
      <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function LinesOverview() {
  const { current, lowStockThreshold, reorderLineSettings } =
    useInventoryData();

  const availablePriorityLines = useMemo(
    () =>
      PRIORITY_PRODUCT_LINES.filter((line) =>
        current.some((item) => item.productLine === line),
      ),
    [current],
  );
  const [selectedLine, setSelectedLine] = useState(
    availablePriorityLines[0] ?? PRIORITY_PRODUCT_LINES[0],
  );
  const [historyTarget, setHistoryTarget] = useState<ProductHistorySubject | null>(
    null,
  );

  const lineGroups = useMemo(
    () =>
      availablePriorityLines.map((line) => {
        const reorderPoint = getReorderPointForLine(
          line,
          reorderLineSettings,
          lowStockThreshold,
        );
        const products = current
          .filter((item) => item.productLine === line)
          .map((item) => ({
            ...item,
            level: getStockLevel(item.available, reorderPoint),
          }))
          .sort(
            (a, b) =>
              levelMeta[a.level].order - levelMeta[b.level].order ||
              a.available - b.available ||
              a.productName.localeCompare(b.productName, "es"),
          );
        const counts = {
          exhausted: products.filter((item) => item.level === "exhausted").length,
          low: products.filter((item) => item.level === "low").length,
          medium: products.filter((item) => item.level === "medium").length,
          high: products.filter((item) => item.level === "high").length,
        };
        return {
          line,
          products,
          counts,
        };
      }),
    [availablePriorityLines, current, lowStockThreshold, reorderLineSettings],
  );

  const selected =
    lineGroups.find((group) => group.line === selectedLine) ?? lineGroups[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Catálogo prioritario"
        title="Líneas principales"
        description="Revisa el inventario de las líneas prioritarias y consulta rápidamente cuáles referencias requieren atención."
        icon={Layers3}
        action={
          <Button asChild variant="outline">
            <Link href="/analytics">
              Comparar fechas
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

      <section
        aria-label="Seleccionar línea principal"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {lineGroups.map((group) => {
          const active = group.line === selected?.line;
          const attention = group.counts.exhausted + group.counts.low;
          return (
            <button
              key={group.line}
              type="button"
              onClick={() => setSelectedLine(group.line)}
              aria-pressed={active}
              className={cn(
                "min-h-36 cursor-pointer rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors duration-200 hover:border-primary/70 hover:bg-muted/35",
                active && "border-primary bg-primary/10 ring-2 ring-primary/25",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl font-bold uppercase">
                    {group.line}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.products.length} referencias
                  </p>
                </div>
                <ArrowRight
                  className={cn(
                    "size-5 text-muted-foreground transition-transform",
                    active && "translate-x-1 text-foreground",
                  )}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive">
                  {attention} por atender
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                  {group.counts.high} altos
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {selected ? (
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-3xl uppercase">
                {selected.line}
              </CardTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="destructive">
                  <PackageX /> {selected.counts.exhausted} agotados
                </Badge>
                <Badge variant="outline" className="border-orange-500/40">
                  <CircleAlert /> {selected.counts.low} bajos
                </Badge>
                <Badge variant="secondary">
                  {selected.counts.medium} medios
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                >
                  <PackageCheck /> {selected.counts.high} altos
                </Badge>
              </div>
            </div>
            <Button asChild>
              <Link
                href={`/inventory?line=${encodeURIComponent(selected.line)}`}
              >
                Abrir inventario filtrado
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Historial</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.products.map((item) => (
                    <TableRow key={`${item.sku}-${item.warehouse}`}>
                      <TableCell className="font-mono text-xs font-bold">
                        {item.sku}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.productName}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {number.format(item.available)}
                      </TableCell>
                      <TableCell>
                        <LevelBadge level={item.level} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setHistoryTarget(item)}
                          aria-label={`Ver historial de ${item.sku}`}
                          title="Ver historial del SKU"
                        >
                          <History />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:hidden">
              {selected.products.map((item) => (
                <div
                  key={`${item.sku}-${item.warehouse}`}
                  className={cn(
                    "rounded-xl border border-l-4 p-4",
                    levelMeta[item.level].className,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold">{item.sku}</p>
                      <p className="mt-1 font-semibold">{item.productName}</p>
                    </div>
                    <LevelBadge level={item.level} />
                  </div>
                  <div className="mt-3 text-sm">
                    <p>
                      Disponible:{" "}
                      <strong className="tabular-nums">
                        {number.format(item.available)}
                      </strong>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setHistoryTarget(item)}
                  >
                    <History /> Ver historial del SKU
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ProductHistorySheet
        item={historyTarget}
        open={Boolean(historyTarget)}
        onOpenChange={(open) => {
          if (!open) setHistoryTarget(null);
        }}
      />
    </div>
  );
}
