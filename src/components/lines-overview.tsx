"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Layers3,
  PackageOpen,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getStockLevel,
  normalizeInventoryText,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import { getReorderPointForLine } from "@/lib/inventory/reorder";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const PRODUCTS_PER_PAGE = 20;

function CompositionBar({
  inStock,
  low,
  exhausted,
  references,
}: {
  inStock: number;
  low: number;
  exhausted: number;
  references: number;
}) {
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-muted"
      aria-label={`${inStock} con stock, ${low} bajas y ${exhausted} agotadas`}
    >
      {inStock > 0 ? (
        <span className="h-full bg-foreground" style={{ width: `${(inStock / references) * 100}%` }} />
      ) : null}
      {low > 0 ? (
        <span className="h-full bg-primary" style={{ width: `${(low / references) * 100}%` }} />
      ) : null}
      {exhausted > 0 ? (
        <span className="h-full bg-destructive" style={{ width: `${(exhausted / references) * 100}%` }} />
      ) : null}
    </div>
  );
}

export function LinesOverview() {
  const { current, lowStockThreshold, reorderLineSettings } = useInventoryData();
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [productPage, setProductPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const availablePriorityLines = useMemo(
    () =>
      PRIORITY_PRODUCT_LINES.filter((line) =>
        current.some((item) => item.productLine === line),
      ),
    [current],
  );

  const lineHealth = useMemo(() => {
    return availablePriorityLines
      .map((line) => {
        const reorderPoint = getReorderPointForLine(
          line,
          reorderLineSettings,
          lowStockThreshold,
        );
        const products = current.filter((item) => item.productLine === line);
        const references = products.length;
        const exhausted = products.filter(
          (item) => getStockLevel(item.available, reorderPoint) === "exhausted",
        ).length;
        const low = products.filter(
          (item) => getStockLevel(item.available, reorderPoint) === "low",
        ).length;
        const inStock = references - exhausted - low;
        const health = references
          ? Math.round(((references - exhausted) / references) * 100)
          : 100;
        return { line, references, exhausted, low, inStock, health, reorderPoint };
      })
      .sort((a, b) => a.health - b.health || b.references - a.references);
  }, [availablePriorityLines, current, lowStockThreshold, reorderLineSettings]);

  const activeGroup =
    lineHealth.find((group) => group.line === selectedLine) ?? lineHealth[0];
  const normalizedQuery = normalizeInventoryText(deferredQuery.trim());
  const selectedProducts = useMemo(() => {
    if (!activeGroup) return [];
    return current
      .filter((item) => item.productLine === activeGroup.line)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return normalizeInventoryText(
          `${item.sku} ${item.productName} ${item.warehouse}`,
        ).includes(normalizedQuery);
      })
      .sort(
        (a, b) =>
          a.available - b.available ||
          a.productName.localeCompare(b.productName, "es"),
      );
  }, [activeGroup, current, normalizedQuery]);
  const totalProductPages = Math.max(
    1,
    Math.ceil(selectedProducts.length / PRODUCTS_PER_PAGE),
  );
  const currentProductPage = Math.min(productPage, totalProductPages);
  const firstVisibleProduct =
    (currentProductPage - 1) * PRODUCTS_PER_PAGE;
  const visibleProducts = selectedProducts.slice(
    firstVisibleProduct,
    firstVisibleProduct + PRODUCTS_PER_PAGE,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Líneas principales"
        subtitle={`${lineHealth.length} líneas prioritarias · consulta sus referencias sin salir del panel`}
        actions={
          <Button asChild variant="outline">
            <Link href="/analytics">
              Comparar fechas
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground" aria-hidden="true" />
          Con stock
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
          Bajo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive" aria-hidden="true" />
          Agotado
        </span>
      </div>

      {lineHealth.length > 0 ? (
        <section
          className="overflow-hidden rounded-[14px] border bg-card xl:grid xl:grid-cols-[minmax(350px,0.78fr)_minmax(0,1.22fr)]"
          aria-label="Líneas e inventario"
        >
          <div className="border-b xl:border-b-0 xl:border-r">
            <div className="grid h-11 grid-cols-[minmax(0,1fr)_76px] items-center border-b bg-table-header px-4 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span>Línea y composición</span>
              <span className="text-right">Salud</span>
            </div>
            <div className="divide-y divide-row-separator">
              {lineHealth.map((group) => {
                const selected = activeGroup?.line === group.line;
                return (
                  <button
                    key={group.line}
                    type="button"
                    onClick={() => {
                      setSelectedLine(group.line);
                      setQuery("");
                      setProductPage(1);
                    }}
                    className={cn(
                      "relative grid min-h-[74px] w-full grid-cols-[minmax(0,1fr)_76px] items-center gap-4 px-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected && "bg-primary/10",
                    )}
                    aria-pressed={selected}
                  >
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden="true" />
                    ) : null}
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate font-display text-[16px] uppercase">{group.line}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {number.format(group.references)} ref.
                        </span>
                      </span>
                      <span className="mt-2 block">
                        <CompositionBar {...group} />
                      </span>
                      <span className="mt-1.5 flex gap-3 text-[10.5px] text-muted-foreground">
                        <span>{group.inStock} con stock</span>
                        <span className="font-semibold text-warning">{group.low} bajas</span>
                        <span className="font-semibold text-destructive">{group.exhausted} agotadas</span>
                      </span>
                    </span>
                    <span className="flex items-center justify-end gap-1">
                      <span
                        className={cn(
                          "font-display text-[19px] tabular-nums",
                          group.health < 90 && "text-destructive",
                        )}
                      >
                        {group.health}%
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          selected && "translate-x-0.5 text-foreground",
                        )}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeGroup ? (
            <div className="min-w-0">
              <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Inventario de la línea
                  </p>
                  <h2 className="mt-1 font-display text-2xl uppercase">{activeGroup.line}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Umbral de esta línea: {number.format(activeGroup.reorderPoint)} unidades
                  </p>
                </div>
                <div className="relative w-full sm:max-w-[280px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setProductPage(1);
                    }}
                    placeholder="Buscar SKU o producto…"
                    aria-label={`Buscar dentro de ${activeGroup.line}`}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="hidden grid-cols-[minmax(0,1fr)_100px] border-b bg-table-header px-4 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground sm:grid">
                <span className="flex h-10 items-center">Producto</span>
                <span className="flex h-10 items-center justify-end">Disponible</span>
              </div>
              {visibleProducts.length > 0 ? (
                <div className="divide-y divide-row-separator">
                  {visibleProducts.map((item) => {
                    const level = getStockLevel(item.available, activeGroup.reorderPoint);
                    return (
                      <div
                        key={`${item.sku}-${item.warehouse}`}
                        className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_100px] sm:gap-0"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="truncate text-[13px] font-semibold" title={item.productName}>{item.productName}</p>
                          <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                            {item.sku} · {item.warehouse}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              "font-display text-lg tabular-nums",
                              level === "exhausted" && "text-destructive",
                              level === "low" && "text-warning",
                            )}
                          >
                            {number.format(item.available)}
                          </p>
                          <p className="text-[9.5px] uppercase text-muted-foreground sm:hidden">disponible</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-48 place-items-center p-6 text-center">
                  <div>
                    <PackageOpen className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold">No hay coincidencias en esta línea</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setProductPage(1);
                      }}
                      className="mt-1 text-xs font-semibold text-warning underline-offset-4 hover:underline"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {selectedProducts.length > 0
                    ? `${number.format(firstVisibleProduct + 1)}–${number.format(
                        Math.min(
                          firstVisibleProduct + PRODUCTS_PER_PAGE,
                          selectedProducts.length,
                        ),
                      )} de ${number.format(selectedProducts.length)} referencias`
                    : "0 referencias"}
                </span>
                <nav className="flex items-center gap-2" aria-label="Páginas de referencias">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentProductPage === 1}
                    onClick={() => setProductPage((page) => Math.max(1, page - 1))}
                    aria-label="Ver referencias anteriores"
                  >
                    <ChevronLeft data-icon="inline-start" aria-hidden="true" />
                    Anterior
                  </Button>
                  <span
                    className="min-w-20 text-center font-semibold tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {currentProductPage} de {totalProductPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentProductPage === totalProductPages}
                    onClick={() =>
                      setProductPage((page) =>
                        Math.min(totalProductPages, page + 1),
                      )
                    }
                    aria-label="Ver referencias siguientes"
                  >
                    Siguiente
                    <ChevronRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </nav>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed p-8 text-center">
          <div>
            <Layers3 className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-semibold">Todavía no hay líneas prioritarias con inventario</p>
          </div>
        </div>
      )}
    </div>
  );
}
