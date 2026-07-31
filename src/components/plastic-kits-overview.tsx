"use client";

import { Boxes, CircleAlert, PackageCheck, PackageX, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPlasticKitColor,
  getPlasticKitLine,
  PLASTIC_KIT_IDS,
  PLASTIC_KIT_LINES,
  type PlasticKitColor,
  type PlasticKitLineKey,
} from "@/lib/inventory/plastic-kits";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

const colorSurfaceClasses: Record<PlasticKitColor, string> = {
  Negro:
    "bg-neutral-950/[0.18] hover:bg-neutral-950/[0.24] dark:bg-black/55 dark:hover:bg-black/70",
  "Rojo cherry":
    "bg-rose-900/[0.12] hover:bg-rose-900/[0.18] dark:bg-rose-500/[0.12] dark:hover:bg-rose-500/[0.18]",
  Rojo:
    "bg-red-600/[0.1] hover:bg-red-600/[0.16] dark:bg-red-500/[0.12] dark:hover:bg-red-500/[0.18]",
  Blanco:
    "bg-neutral-100/90 hover:bg-white dark:bg-white/[0.24] dark:hover:bg-white/[0.3]",
  Azul:
    "bg-blue-600/[0.1] hover:bg-blue-600/[0.16] dark:bg-blue-500/[0.12] dark:hover:bg-blue-500/[0.18]",
  Verde:
    "bg-emerald-600/[0.1] hover:bg-emerald-600/[0.16] dark:bg-emerald-500/[0.12] dark:hover:bg-emerald-500/[0.18]",
  Gris:
    "bg-neutral-500/[0.2] hover:bg-neutral-500/[0.27] dark:bg-neutral-400/[0.15] dark:hover:bg-neutral-400/[0.21]",
  Arena:
    "bg-amber-300/20 hover:bg-amber-300/30 dark:bg-amber-300/[0.12] dark:hover:bg-amber-300/[0.18]",
  Transparente:
    "bg-sky-200/25 hover:bg-sky-200/40 dark:bg-sky-200/[0.08] dark:hover:bg-sky-200/[0.13]",
  "Sin color": "bg-muted/30 hover:bg-muted/50",
};

type SelectedLine = "all" | PlasticKitLineKey;

function KitColorLabel({ color }: { color: PlasticKitColor }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-foreground/15 bg-background/70 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
      {color}
    </span>
  );
}

function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock <= 0) {
    return <Badge variant="destructive"><PackageX /> Agotado</Badge>;
  }
  if (stock <= threshold) {
    return (
      <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300">
        <CircleAlert /> Bajo
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      <PackageCheck /> Disponible
    </Badge>
  );
}

export function PlasticKitsOverview() {
  const { current, lowStockThreshold } = useInventoryData();
  const [selectedLine, setSelectedLine] = useState<SelectedLine>("all");

  const kits = useMemo(
    () =>
      current
        .filter((item) => PLASTIC_KIT_IDS.has(item.sku.trim()))
        .map((item) => ({
          ...item,
          kitLine: getPlasticKitLine(item.sku),
          kitColor: getPlasticKitColor(item.productName),
        }))
        .filter((item) => item.kitLine)
        .sort((a, b) =>
          a.kitLine!.label.localeCompare(b.kitLine!.label, "es") ||
          a.available - b.available ||
          Number(a.sku) - Number(b.sku),
        ),
    [current],
  );

  const visibleKits = useMemo(
    () =>
      selectedLine === "all"
        ? kits
        : kits.filter((item) => item.kitLine?.key === selectedLine),
    [kits, selectedLine],
  );
  const totalStock = kits.reduce((total, item) => total + item.available, 0);
  const exhausted = kits.filter((item) => item.available <= 0).length;
  const low = kits.filter(
    (item) => item.available > 0 && item.available <= lowStockThreshold,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Bodega Principal"
        title="Kit Plástico"
        description="Revisa las existencias de los kits seleccionados y filtra rápidamente por línea de moto."
        icon={Boxes}
      />

      <section aria-label="Resumen de kits plásticos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Referencias cargadas", value: `${kits.length} / ${PLASTIC_KIT_IDS.size}`, icon: Boxes },
          { label: "Unidades disponibles", value: number.format(totalStock), icon: Warehouse },
          { label: "Referencias agotadas", value: number.format(exhausted), icon: PackageX },
          { label: "Stock bajo", value: number.format(low), icon: CircleAlert },
        ].map((metric) => (
          <Card key={metric.label} className="racing-stripe">
            <CardContent className="flex items-center justify-between gap-4 pt-5 sm:pt-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{metric.label}</p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums">{metric.value}</p>
              </div>
              <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <metric.icon className="size-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">Filtrar por línea</CardTitle>
          <p className="text-sm text-muted-foreground">Cada viñeta muestra las referencias cargadas de esa familia.</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Líneas de kit plástico">
            <button
              type="button"
              onClick={() => setSelectedLine("all")}
              aria-pressed={selectedLine === "all"}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                selectedLine === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/70 hover:bg-muted",
              )}
            >
              <span className="mr-2 inline-block size-2 rounded-full bg-current" aria-hidden="true" />
              Todas · {kits.length}
            </button>
            {PLASTIC_KIT_LINES.map((line) => {
              const count = kits.filter((item) => item.kitLine?.key === line.key).length;
              return (
                <button
                  key={line.key}
                  type="button"
                  onClick={() => setSelectedLine(line.key)}
                  aria-pressed={selectedLine === line.key}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                    selectedLine === line.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/70 hover:bg-muted",
                  )}
                >
                  <span className="mr-2 inline-block size-2 rounded-full bg-current" aria-hidden="true" />
                  {line.label} · {count}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="font-display text-2xl uppercase">
              {selectedLine === "all" ? "Todos los kits" : PLASTIC_KIT_LINES.find((line) => line.key === selectedLine)?.label}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Stock de “Principal” · {visibleKits.length} referencias</p>
          </div>
        </CardHeader>
        <CardContent>
          {kits.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Warehouse className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 font-semibold">Todavía no hay kits en el inventario publicado.</p>
              <p className="mt-1 text-sm text-muted-foreground">Carga nuevamente el Excel que incluye “Stock bodega: Principal (Sucursal: Principal)”.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">ID</TableHead>
                      <TableHead>Línea</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Versión</TableHead>
                      <TableHead className="text-right">Stock Principal</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleKits.map((item) => (
                      <TableRow
                        key={`${item.sku}-${item.warehouse}`}
                        className={colorSurfaceClasses[item.kitColor]}
                      >
                        <TableCell className="font-mono text-xs font-bold">{item.sku}</TableCell>
                        <TableCell className="font-semibold">{item.kitLine?.label}</TableCell>
                        <TableCell className="max-w-xl">
                          <div className="flex items-start gap-3">
                            <KitColorLabel color={item.kitColor} />
                            <span className="font-semibold leading-snug">{item.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.productName.includes("CON FAROLA") ? "Con farola" : "Sin farola"}</TableCell>
                        <TableCell className="text-right text-lg font-bold tabular-nums">{number.format(item.available)}</TableCell>
                        <TableCell><StockBadge stock={item.available} threshold={lowStockThreshold} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="data-list grid gap-3 md:hidden">
                {visibleKits.map((item) => (
                  <article
                    key={`${item.sku}-${item.warehouse}`}
                    className={cn(
                      "overflow-hidden rounded-xl border transition-colors",
                      colorSurfaceClasses[item.kitColor],
                    )}
                  >
                    <div className="border-b border-foreground/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-bold">ID {item.sku}</span>
                        <KitColorLabel color={item.kitColor} />
                      </div>
                      <p className="mt-2 font-semibold leading-snug">{item.productName}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">{item.kitLine?.label}</p>
                        <p className="mt-1 text-sm">{item.productName.includes("CON FAROLA") ? "Con farola" : "Sin farola"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">{number.format(item.available)}</p>
                        <StockBadge stock={item.available} threshold={lowStockThreshold} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
