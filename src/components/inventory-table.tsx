"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  History,
  PackageOpen,
  PackageSearch,
  Paperclip,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ProductDocumentsDialog } from "@/components/product-documents-dialog";
import { ProductHistorySheet } from "@/components/product-history-sheet";
import { useProfile } from "@/components/providers/profile-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  compareProductLines,
  normalizeInventoryText,
} from "@/lib/inventory/priority-lines";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

type SortKey = "productName" | "stock" | "available";
type Availability = "all" | "available" | "low" | "exhausted";

function levelOf(available: number, threshold: number): "exhausted" | "low" | "ok" {
  if (available <= 0) return "exhausted";
  if (available <= threshold) return "low";
  return "ok";
}

function LevelCell({
  available,
  threshold,
}: {
  available: number;
  threshold: number;
}) {
  const level = levelOf(available, threshold);
  const percent =
    level === "exhausted"
      ? 100
      : level === "low"
        ? Math.max(6, Math.min(100, (available / Math.max(1, threshold)) * 100))
        : 100;
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "size-[7px] shrink-0 rounded-full",
          level === "exhausted" && "bg-destructive",
          level === "low" && "bg-primary",
          level === "ok" && "bg-foreground",
        )}
        aria-hidden="true"
      />
      <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            level === "exhausted" && "bg-destructive",
            level === "low" && "bg-primary",
            level === "ok" && "bg-foreground",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[11px] font-bold",
          level === "exhausted" && "text-destructive",
          level === "low" && "text-warning",
          level === "ok" && "text-muted-foreground",
        )}
      >
        {level === "exhausted" ? "Agot." : level === "low" ? "Bajo" : "OK"}
      </span>
    </div>
  );
}

function SortIcon({ active, descending }: { active: boolean; descending: boolean }) {
  if (!active) return <ArrowUpDown className="size-3.5" aria-hidden="true" />;
  return descending ? (
    <ArrowDown className="size-3.5 text-foreground" aria-hidden="true" />
  ) : (
    <ArrowUp className="size-3.5 text-foreground" aria-hidden="true" />
  );
}

export function InventoryTable({
  items,
  lowStockThreshold,
  initialLine = "all",
  initialQuery = "",
}: {
  items: InventoryItem[];
  lowStockThreshold: number;
  initialLine?: string;
  initialQuery?: string;
}) {
  const profile = useProfile();
  const [query, setQuery] = useState(initialQuery);
  const [line, setLine] = useState(initialLine);
  const [availability, setAvailability] = useState<Availability>("all");
  const [sortKey, setSortKey] = useState<SortKey>("productName");
  const [descending, setDescending] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [documentItem, setDocumentItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const deferredQuery = useDeferredValue(query);

  const lines = useMemo(
    () =>
      [...new Set(items.map((item) => item.productLine))].sort(
        compareProductLines,
      ),
    [items],
  );

  const searchedAndLined = useMemo(() => {
    const normalizedQuery = normalizeInventoryText(deferredQuery);
    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeInventoryText(item.sku).includes(normalizedQuery) ||
        normalizeInventoryText(item.productName).includes(normalizedQuery) ||
        normalizeInventoryText(item.productLine).includes(normalizedQuery);
      const matchesLine =
        line === "all" ||
        normalizeInventoryText(item.productLine) ===
          normalizeInventoryText(line);
      return matchesQuery && matchesLine;
    });
  }, [items, line, deferredQuery]);

  const statusCounts = useMemo(
    () => ({
      all: searchedAndLined.length,
      available: searchedAndLined.filter(
        (item) => item.available > lowStockThreshold,
      ).length,
      low: searchedAndLined.filter(
        (item) => item.available > 0 && item.available <= lowStockThreshold,
      ).length,
      exhausted: searchedAndLined.filter((item) => item.available <= 0).length,
    }),
    [searchedAndLined, lowStockThreshold],
  );

  const filtered = useMemo(() => {
    return searchedAndLined
      .filter((item) => {
        if (availability === "all") return true;
        if (availability === "available") return item.available > lowStockThreshold;
        if (availability === "low")
          return item.available > 0 && item.available <= lowStockThreshold;
        return item.available <= 0;
      })
      .sort((a, b) => {
        const first = a[sortKey];
        const second = b[sortKey];
        const result =
          typeof first === "number"
            ? first - Number(second)
            : String(first).localeCompare(String(second), "es");
        return descending ? -result : result;
      });
  }, [searchedAndLined, availability, sortKey, descending, lowStockThreshold]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const firstVisible = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(safePage * pageSize, filtered.length);
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const canManageDocuments =
    profile.role === "admin" || profile.role === "uploader";

  function changeSort(next: SortKey) {
    if (sortKey === next) setDescending((value) => !value);
    else {
      setSortKey(next);
      setDescending(false);
    }
  }

  const hasActiveChips = line !== "all" || availability !== "all";
  const activeFilterCount = Number(line !== "all") + Number(availability !== "all");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
        <div className="relative w-full lg:max-w-[380px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="h-[38px] pl-10"
            placeholder="Buscar SKU o producto…"
            aria-label="Buscar por SKU o producto"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal data-icon="inline-start" />
          Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ""}
        </Button>
        <div className="hidden lg:block">
        <Select
          value={line}
          onValueChange={(value) => {
            setLine(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full lg:w-44" aria-label="Filtrar por línea">
            <SelectValue placeholder="Todas las líneas" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Línea</SelectLabel>
              <SelectItem value="all">Todas las líneas</SelectItem>
              {lines.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        </div>

        <div
          role="group"
          aria-label="Filtrar por disponibilidad"
          className="hidden h-[38px] w-full items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5 lg:flex lg:w-auto"
        >
          {(
            [
              { key: "all", label: "Todos", count: statusCounts.all },
              { key: "available", label: "Disponible", count: statusCounts.available },
              { key: "low", label: "Bajo", count: statusCounts.low },
              { key: "exhausted", label: "Agotado", count: statusCounts.exhausted },
            ] as const
          ).map((segment) => (
            <button
              key={segment.key}
              type="button"
              onClick={() => {
                setAvailability(segment.key);
                setPage(1);
              }}
              className={cn(
                "flex-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors lg:flex-none",
                availability === segment.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {segment.label}
              {segment.key !== "all" && (
                <span className="ml-1 tabular-nums opacity-75">{segment.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          {hasActiveChips && (
            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
              {line !== "all" && (
                <button
                  type="button"
                  onClick={() => setLine("all")}
                  className="flex h-6 items-center gap-1 rounded-full border bg-card px-2.5 text-[11.5px] font-medium"
                >
                  {line}
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
              {availability !== "all" && (
                <button
                  type="button"
                  onClick={() => setAvailability("all")}
                  className="flex h-6 items-center gap-1 rounded-full border bg-card px-2.5 text-[11.5px] font-medium"
                >
                  {availability === "available"
                    ? "Disponible"
                    : availability === "low"
                      ? "Bajo"
                      : "Agotado"}
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {number.format(filtered.length)} resultados
          </p>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="flex flex-col gap-5">
          <SheetHeader className="pr-12 text-left">
            <SheetTitle className="font-display text-xl uppercase">Filtros de inventario</SheetTitle>
            <SheetDescription>Combina línea y disponibilidad para acotar los resultados.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Línea</p>
            <Select value={line} onValueChange={(value) => { setLine(value); setPage(1); }}>
              <SelectTrigger aria-label="Filtrar por línea en móvil"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todas las líneas</SelectItem>
                  {lines.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Disponibilidad</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "all", label: "Todos", count: statusCounts.all },
                  { key: "available", label: "Disponible", count: statusCounts.available },
                  { key: "low", label: "Bajo", count: statusCounts.low },
                  { key: "exhausted", label: "Agotado", count: statusCounts.exhausted },
                ] as const
              ).map((segment) => (
                <Button
                  key={segment.key}
                  type="button"
                  variant={availability === segment.key ? "secondary" : "outline"}
                  onClick={() => { setAvailability(segment.key); setPage(1); }}
                >
                  {segment.label} <span className="tabular-nums opacity-65">{segment.count}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-auto flex gap-2 border-t pt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setLine("all"); setAvailability("all"); }} disabled={!hasActiveChips}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Ver {number.format(filtered.length)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="hidden overflow-hidden rounded-[14px] border bg-card lg:block">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_130px_92px_92px_40px] items-center gap-4 border-b bg-table-header px-4 py-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <button
            type="button"
            onClick={() => changeSort("productName")}
            className="flex h-10 items-center gap-1.5 text-left transition-colors hover:text-foreground"
          >
            Producto
            <SortIcon active={sortKey === "productName"} descending={descending} />
          </button>
          <span className="flex h-10 items-center">Nivel</span>
          <button
            type="button"
            onClick={() => changeSort("stock")}
            className="flex h-10 items-center justify-end gap-1.5 text-right transition-colors hover:text-foreground"
          >
            <SortIcon active={sortKey === "stock"} descending={descending} />
            Existencia
          </button>
          <button
            type="button"
            onClick={() => changeSort("available")}
            className="flex h-10 items-center justify-end gap-1.5 text-right transition-colors hover:text-foreground"
          >
            <SortIcon active={sortKey === "available"} descending={descending} />
            Disponible
          </button>
          <span className="flex h-10 items-center" aria-hidden="true" />
        </div>
        <div className="divide-y divide-row-separator">
          {pageItems.map((item, index) => (
            <div
              key={`${item.sku}-${item.warehouse}`}
              className={cn(
                "group grid min-h-12 grid-cols-[minmax(0,1fr)_130px_92px_92px_40px] items-center gap-4 px-4",
                index % 2 === 1 && "bg-row-alt",
              )}
            >
              <div className="min-w-0 py-2">
                <p className="truncate text-[13.5px] font-semibold">{item.productName}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {item.sku} · {item.productLine}
                </p>
              </div>
              <LevelCell available={item.available} threshold={lowStockThreshold} />
              <p className="text-right text-[13px] tabular-nums text-muted-foreground">
                {number.format(item.stock)}
              </p>
              <p
                className={cn(
                  "text-right text-[15px] font-bold tabular-nums",
                  item.available <= 0 && "text-destructive",
                )}
              >
                {number.format(item.available)}
              </p>
              <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Ver historial de ${item.sku}, ${item.productName}`}
                  onClick={() => setHistoryItem(item)}
                >
                  <History className="size-4" />
                </Button>
                {canManageDocuments && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Documentos de ${item.productName}`}
                    onClick={() => setDocumentItem(item)}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-row-separator rounded-[14px] border bg-card lg:hidden">
        {pageItems.map((item) => {
          const level = levelOf(item.available, lowStockThreshold);
          return (
            <div
              key={`${item.sku}-${item.warehouse}`}
              className={cn(
                "flex min-h-[76px] items-stretch",
                level === "exhausted" && "shadow-[inset_3px_0_0_hsl(var(--destructive))]",
                level === "low" && "shadow-[inset_3px_0_0_hsl(var(--primary))]",
              )}
            >
              <button
                type="button"
                onClick={() => setHistoryItem(item)}
                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={`Ver historial de ${item.sku}, ${item.productName}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{item.productName}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {item.sku} · {item.productLine}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "font-display text-lg tabular-nums",
                      level === "exhausted" && "text-destructive",
                    )}
                  >
                    {number.format(item.available)}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">disp.</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
              {canManageDocuments && (
                <div className="flex items-center px-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Documentos de ${item.productName}`}
                    onClick={() => setDocumentItem(item)}
                  >
                    <Paperclip />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pageItems.length === 0 && (
        <EmptyState
          icon={line !== "all" || availability !== "all" || deferredQuery ? PackageSearch : PackageOpen}
          title="No encontramos productos"
          description={
            line !== "all" || availability !== "all" || deferredQuery
              ? "Ajusta la búsqueda o limpia los filtros para volver a ver el inventario."
              : "Todavía no hay inventario cargado."
          }
          action={
            (line !== "all" || availability !== "all" || deferredQuery) && (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setLine("all");
                  setAvailability("all");
                }}
              >
                Limpiar filtros
              </Button>
            )
          }
          className="rounded-2xl border"
        />
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {firstVisible}–{lastVisible} de {number.format(filtered.length)} ·{" "}
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger
                className="inline-flex h-7 w-auto gap-1 border-none bg-transparent px-1 text-sm text-muted-foreground shadow-none"
                aria-label="Productos por página"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="50">50 por página</SelectItem>
                  <SelectItem value="100">100 por página</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center text-sm font-medium">
              {safePage} de {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={safePage >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <ProductDocumentsDialog
        item={documentItem}
        open={Boolean(documentItem)}
        onOpenChange={(open) => {
          if (!open) setDocumentItem(null);
        }}
      />
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
