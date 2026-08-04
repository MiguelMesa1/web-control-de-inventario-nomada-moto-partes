"use client";

import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  Paperclip,
  Search,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ProductDocumentsDialog } from "@/components/product-documents-dialog";
import { useProfile } from "@/components/providers/profile-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  compareProductLines,
  normalizeInventoryText,
} from "@/lib/inventory/priority-lines";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryItem } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

type SortKey = "productName" | "available" | "productLine";

function StockBadge({
  available,
  threshold,
}: {
  available: number;
  threshold: number;
}) {
  if (available <= 0) return <Badge variant="destructive">Agotado</Badge>;
  if (available <= threshold) return <Badge variant="outline">Bajo</Badge>;
  return <Badge>Disponible</Badge>;
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
  const [availability, setAvailability] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("productName");
  const [descending, setDescending] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const deferredQuery = useDeferredValue(query);

  const lines = useMemo(
    () =>
      [...new Set(items.map((item) => item.productLine))].sort(
        compareProductLines,
      ),
    [items],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeInventoryText(deferredQuery);
    return items
      .filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          normalizeInventoryText(item.sku).includes(normalizedQuery) ||
          normalizeInventoryText(item.productName).includes(normalizedQuery) ||
          normalizeInventoryText(item.productLine).includes(normalizedQuery);
        const matchesLine =
          line === "all" ||
          normalizeInventoryText(item.productLine) ===
            normalizeInventoryText(line);
        const matchesAvailability =
          availability === "all" ||
          (availability === "available" && item.available > lowStockThreshold) ||
          (availability === "low" &&
            item.available > 0 &&
            item.available <= lowStockThreshold) ||
          (availability === "exhausted" && item.available <= 0);
        return (
          matchesQuery &&
          matchesLine &&
          matchesAvailability
        );
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
  }, [
    availability,
    descending,
    items,
    line,
    lowStockThreshold,
    deferredQuery,
    sortKey,
  ]);

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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,0.7fr)]">
            <div className="relative">
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
                className="h-11 pl-10"
                placeholder="Buscar SKU o producto…"
                aria-label="Buscar por SKU o producto"
              />
            </div>
            <Select
              value={line}
              onValueChange={(value) => {
                setLine(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-11" aria-label="Filtrar por línea">
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
            <Select
              value={availability}
              onValueChange={(value) => {
                setAvailability(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-11" aria-label="Filtrar por disponibilidad">
                <SelectValue placeholder="Disponibilidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Estado</SelectLabel>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="low">Inventario bajo</SelectItem>
                  <SelectItem value="exhausted">Agotado</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger
                className="h-11"
                aria-label="Productos por página"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Productos por página</SelectLabel>
                  <SelectItem value="50">Mostrar 50</SelectItem>
                  <SelectItem value="100">Mostrar 100</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => changeSort("productName")}
                >
                  Producto
                  <ArrowUpDown data-icon="inline-end" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => changeSort("productLine")}
                >
                  Línea
                  <ArrowUpDown data-icon="inline-end" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => changeSort("available")}
                >
                  Disponible
                  <ArrowUpDown data-icon="inline-end" />
                </Button>
              </TableHead>
              <TableHead>Estado</TableHead>
              {canManageDocuments && (
                <TableHead className="text-right">Documentos</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((item) => (
              <TableRow key={`${item.sku}-${item.warehouse}`}>
                <TableCell className="font-mono text-xs font-bold">
                  {item.sku}
                </TableCell>
                <TableCell className="max-w-64 font-medium">
                  {item.productName}
                </TableCell>
                <TableCell>{item.productLine}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {number.format(item.stock)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {number.format(item.reserved)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {number.format(item.available)}
                </TableCell>
                <TableCell>
                  <StockBadge
                    available={item.available}
                    threshold={lowStockThreshold}
                  />
                </TableCell>
                {canManageDocuments && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Documentos de ${item.productName}`}
                      onClick={() => setSelectedItem(item)}
                    >
                      <Paperclip />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="data-list grid gap-3 md:hidden">
        {pageItems.map((item) => (
          <Card key={`${item.sku}-${item.warehouse}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-muted-foreground">
                    {item.sku}
                  </p>
                  <h3 className="mt-1 font-semibold">{item.productName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.productLine}
                  </p>
                </div>
                <StockBadge
                  available={item.available}
                  threshold={lowStockThreshold}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3 text-center">
                <div>
                  <p className="text-[0.68rem] uppercase text-muted-foreground">
                    Existencia
                  </p>
                  <p className="mt-1 font-bold tabular-nums">
                    {number.format(item.stock)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.68rem] uppercase text-muted-foreground">
                    Reservado
                  </p>
                  <p className="mt-1 font-bold tabular-nums">
                    {number.format(item.reserved)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.68rem] uppercase text-muted-foreground">
                    Disponible
                  </p>
                  <p className="mt-1 font-bold tabular-nums">
                    {number.format(item.available)}
                  </p>
                </div>
              </div>
              {canManageDocuments && (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setSelectedItem(item)}
                >
                  <Paperclip data-icon="inline-start" />
                  Ver documentos
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pageItems.length === 0 && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <PackageOpen className="size-10 text-primary" aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl uppercase">
              No encontramos productos
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Ajusta la búsqueda o limpia los filtros para volver a ver el
              inventario.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {firstVisible}–{lastVisible} de {filtered.length} productos
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center text-sm font-medium">
            {safePage} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={safePage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            aria-label="Página siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <ProductDocumentsDialog
        item={selectedItem}
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
    </div>
  );
}
