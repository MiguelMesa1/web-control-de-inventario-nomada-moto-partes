"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  LoaderCircle,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ProductHistorySheet } from "@/components/product-history-sheet";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";
import {
  buildActiveOrderBySku,
  type ActiveOrderSummary,
} from "@/lib/orders/active-orders";
import { cn } from "@/lib/utils";
import type {
  ProductHistorySubject,
  PurchaseOrder,
  ReorderAlertRow,
  ReorderWatchItem,
} from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type FormState = {
  sourceId: string;
  sku: string;
  productName: string;
  primarySupplier: string;
  secondarySupplier: string;
  minimumStock: string;
  maximumStock: string;
  notes: string;
};

const emptyForm: FormState = {
  sourceId: "",
  sku: "",
  productName: "",
  primarySupplier: "",
  secondarySupplier: "",
  minimumStock: "10",
  maximumStock: "20",
  notes: "",
};

type Tab = "pending" | "ordered" | "unregistered" | "all";

function StatusLabel({
  row,
  activeOrder,
}: {
  row: ReorderAlertRow;
  activeOrder?: ActiveOrderSummary;
}) {
  if (activeOrder?.status === "ordered") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">
        <Truck className="size-3.5" aria-hidden="true" />
        Pedido en curso
      </span>
    );
  }
  if (activeOrder?.status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-warning">
        <ClipboardCheck className="size-3.5" aria-hidden="true" />
        En borrador
      </span>
    );
  }
  if (row.status === "missing")
    return <span className="text-[11.5px] font-bold text-muted-foreground">Sin registro</span>;
  if (row.status === "exhausted")
    return <span className="text-[11.5px] font-bold text-destructive">Agotado</span>;
  if (row.status === "low")
    return <span className="text-[11.5px] font-bold text-warning">Por reponer</span>;
  return <span className="text-[11.5px] font-bold text-success">Nivel estable</span>;
}

function SuggestedStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex h-[30px] items-center rounded-lg border">
      <button
        type="button"
        className="grid h-full w-7 place-items-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Disminuir cantidad sugerida"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-10 text-center text-[13px] font-bold tabular-nums">{value}</span>
      <button
        type="button"
        className="grid h-full w-7 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar cantidad sugerida"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function ReorderWatchlist({
  purchaseOrders,
  initialQuery = "",
}: {
  purchaseOrders: PurchaseOrder[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const { current, reorderWatchlist, isDemo } = useInventoryData();
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("pending");
  const [supplier, setSupplier] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReorderWatchItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<ProductHistorySubject | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [suggestedOverrides, setSuggestedOverrides] = useState<Record<string, number>>({});
  const deferredQuery = useDeferredValue(query);
  const pageSize = 40;

  const rows = useMemo(
    () =>
      buildReorderAlertRows(
        reorderWatchlist.filter((item) => item.active),
        current,
      ).sort(
        (a, b) =>
          (a.status === "healthy" ? 1 : 0) - (b.status === "healthy" ? 1 : 0) ||
          a.available - b.available ||
          a.productName.localeCompare(b.productName, "es"),
      ),
    [current, reorderWatchlist],
  );

  const activeOrderBySku = useMemo(
    () => buildActiveOrderBySku(purchaseOrders),
    [purchaseOrders],
  );

  function suggestedFor(row: ReorderAlertRow) {
    return suggestedOverrides[row.sku] ?? row.suggestedQuantity;
  }

  const supplierOptions = useMemo(
    () =>
      [
        ...new Set(
          reorderWatchlist.flatMap((item) =>
            [item.primarySupplier, item.secondarySupplier].filter(
              (value): value is string => Boolean(value),
            ),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [reorderWatchlist],
  );

  const historySubjects = useMemo(() => {
    const subjects = new Map<string, ProductHistorySubject>();
    for (const item of current) {
      const existing = subjects.get(item.sku);
      const isPrincipal = normalizeInventoryText(item.warehouse) === "principal";
      const existingIsPrincipal =
        existing && normalizeInventoryText(existing.warehouse) === "principal";
      if (!existing || (isPrincipal && !existingIsPrincipal)) {
        subjects.set(item.sku, item);
      }
    }
    return subjects;
  }, [current]);

  const tabCounts = useMemo(
    () => ({
      pending: rows.filter((row) => row.status !== "healthy" && !activeOrderBySku.has(row.sku)).length,
      ordered: rows.filter((row) => activeOrderBySku.get(row.sku)?.status === "ordered").length,
      unregistered: rows.filter((row) => row.status === "missing").length,
      all: rows.length,
    }),
    [rows, activeOrderBySku],
  );

  const filtered = useMemo(() => {
    const normalized = normalizeInventoryText(deferredQuery);
    return rows.filter((row) => {
      const matchesQuery =
        !normalized ||
        normalizeInventoryText(row.sku).includes(normalized) ||
        normalizeInventoryText(row.productName).includes(normalized);
      const matchesTab =
        tab === "all" ||
        (tab === "pending" && row.status !== "healthy" && !activeOrderBySku.has(row.sku)) ||
        (tab === "ordered" && activeOrderBySku.get(row.sku)?.status === "ordered") ||
        (tab === "unregistered" && row.status === "missing");
      const matchesSupplier =
        supplier === "all" ||
        row.primarySupplier === supplier ||
        row.secondarySupplier === supplier;
      return matchesQuery && matchesTab && matchesSupplier;
    });
  }, [activeOrderBySku, deferredQuery, rows, tab, supplier]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstVisible = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(safePage * pageSize, filtered.length);
  const metrics = {
    monitored: rows.length,
    attention: rows.filter(
      (row) => row.status !== "healthy" && !activeOrderBySku.has(row.sku),
    ).length,
    exhausted: rows.filter((row) => row.status === "exhausted").length,
    inProgress: rows.filter(
      (row) => activeOrderBySku.get(row.sku)?.status === "ordered",
    ).length,
    suggested: rows.reduce(
      (total, row) =>
        row.status === "healthy" || activeOrderBySku.has(row.sku)
          ? total
          : total + row.suggestedQuantity,
      0,
    ),
  };

  const selectedRows = pageRows.filter((row) => selectedSkus.has(row.sku));
  const selectedUnits = selectedRows.reduce((total, row) => total + suggestedFor(row), 0);
  const allPageSelectable = pageRows.filter((row) => !activeOrderBySku.has(row.sku));
  const allPageSelected =
    allPageSelectable.length > 0 && allPageSelectable.every((row) => selectedSkus.has(row.sku));

  function toggleSelected(sku: string) {
    setSelectedSkus((value) => {
      const next = new Set(value);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedSkus((value) => {
      const next = new Set(value);
      if (allPageSelected) {
        for (const row of allPageSelectable) next.delete(row.sku);
      } else {
        for (const row of allPageSelectable) next.add(row.sku);
      }
      return next;
    });
  }

  const inventoryOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const item of current) options.set(item.sku, item.productName);
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [current]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: ReorderWatchItem) {
    setEditing(item);
    setForm({
      sourceId: item.sourceId?.toString() ?? "",
      sku: item.sku,
      productName: item.productName,
      primarySupplier: item.primarySupplier ?? "",
      secondarySupplier: item.secondarySupplier ?? "",
      minimumStock: item.minimumStock.toString(),
      maximumStock: item.maximumStock.toString(),
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  function changeSku(sku: string) {
    const match = current.find((item) => item.sku === sku);
    setForm((value) => ({
      ...value,
      sku,
      productName: match?.productName ?? value.productName,
    }));
  }

  async function save() {
    const minimumStock = Number(form.minimumStock);
    const maximumStock = Number(form.maximumStock);
    if (!form.sku.trim() || !form.productName.trim() || !form.primarySupplier.trim()) {
      toast.error("Completa la referencia, el producto y el proveedor principal.");
      return;
    }
    if (
      !Number.isInteger(minimumStock) ||
      !Number.isInteger(maximumStock) ||
      minimumStock < 0 ||
      maximumStock < minimumStock
    ) {
      toast.error("El máximo debe ser un entero igual o mayor al mínimo.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemo) {
        const response = await fetch("/api/reorder-watchlist", {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(editing
              ? { id: editing.id }
              : {
                  sourceId: form.sourceId ? Number(form.sourceId) : undefined,
                  sku: form.sku,
                  productName: form.productName,
                }),
            primarySupplier: form.primarySupplier,
            secondarySupplier: form.secondarySupplier,
            minimumStock,
            maximumStock,
            notes: form.notes,
            active: true,
          }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success(editing ? "Configuración actualizada" : "Producto agregado", {
        description: `${form.sku}: mínimo ${minimumStock}, máximo ${maximumStock}.`,
      });
      setDialogOpen(false);
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      router.refresh();
    } catch (error) {
      toast.error("No pudimos guardar el producto", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ReorderWatchItem) {
    if (!window.confirm(`¿Retirar ${item.sku} de la lista de recompra?`)) return;
    setRemovingId(item.id);
    try {
      if (!isDemo) {
        const response = await fetch(
          `/api/reorder-watchlist?id=${encodeURIComponent(item.id)}`,
          { method: "DELETE" },
        );
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success("Producto retirado de la lista de recompra");
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      router.refresh();
    } catch (error) {
      toast.error("No pudimos retirar el producto", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recompra"
        subtitle={`${metrics.attention} por solicitar · ${metrics.inProgress} en pedido · ${number.format(metrics.suggested)} unidades sugeridas`}
        actions={
          <Button asChild>
            <Link href="/orders">
              <Truck data-icon="inline-start" aria-hidden="true" />
              Preparar pedidos
            </Link>
          </Button>
        }
      />

      {metrics.attention > 0 ? (
        <Alert>
          <ClipboardCheck aria-hidden="true" />
          <AlertTitle>
            {metrics.attention} {metrics.attention === 1 ? "producto pendiente" : "productos pendientes"} por pedir
          </AlertTitle>
          <AlertDescription>
            Para completar sus máximos se sugieren {number.format(metrics.suggested)} unidades.
          </AlertDescription>
        </Alert>
      ) : null}

      {metrics.inProgress > 0 ? (
        <Alert>
          <Truck aria-hidden="true" />
          <AlertTitle>
            {metrics.inProgress} {metrics.inProgress === 1 ? "producto tiene" : "productos tienen"} un pedido en curso
          </AlertTitle>
          <AlertDescription>
            Ya están solicitados y no se incluyen nuevamente en las unidades por pedir.{" "}
            <Link href="/orders" className="font-semibold underline underline-offset-4">
              Ver seguimiento
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="font-display text-2xl uppercase">Productos de recompra</CardTitle>
              <CardDescription className="mt-1">
                Mínimos, máximos y proveedores configurados por referencia.
              </CardDescription>
            </div>
            {isAdmin ? (
              <Button variant="outline" onClick={openAdd}>
                <PackagePlus data-icon="inline-start" aria-hidden="true" />
                Agregar producto
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" className="flex items-center gap-4 border-b lg:border-b-0">
              {(
                [
                  { key: "pending", label: "Por solicitar" },
                  { key: "ordered", label: "Solicitado" },
                  { key: "unregistered", label: "Sin registro" },
                  { key: "all", label: "Todos" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => {
                    setTab(item.key);
                    setPage(1);
                  }}
                  className={cn(
                    "border-b-2 border-transparent px-0.5 pb-2.5 text-sm font-semibold text-muted-foreground transition-colors",
                    tab === item.key && "border-foreground text-foreground",
                  )}
                >
                  {item.label}{" "}
                  <span className="tabular-nums opacity-70">{tabCounts[item.key]}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por producto o referencia…"
                  className="h-[34px] w-full pl-10 sm:w-64"
                  aria-label="Buscar productos de recompra"
                />
              </div>
              <Select
                value={supplier}
                onValueChange={(value) => {
                  setSupplier(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-[34px] w-full sm:w-44" aria-label="Filtrar por proveedor">
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos los proveedores</SelectItem>
                    {supplierOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {selectedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-foreground px-5 py-2.5 text-background">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleSelectAllOnPage}
                className="size-4 accent-primary"
              />
            </label>
            <p className="text-sm font-semibold">
              {selectedRows.length} {selectedRows.length === 1 ? "seleccionado" : "seleccionados"} ·{" "}
              {number.format(selectedUnits)} unidades sugeridas
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-background hover:bg-background/15 hover:text-background" onClick={() => setSelectedSkus(new Set())}>
                Quitar selección
              </Button>
              <Button asChild size="sm">
                <Link href="/orders">Ir a pedidos</Link>
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0 pb-2">
          <div className="hidden lg:block">
            <div className="grid grid-cols-[28px_minmax(0,1fr)_150px_76px_66px_100px_130px_84px] items-center gap-3 border-y bg-table-header px-5 py-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleSelectAllOnPage}
                disabled={allPageSelectable.length === 0}
                aria-label="Seleccionar todos los productos de la página"
                className="size-3.5 accent-foreground"
              />
              <span className="flex h-10 items-center">Producto</span>
              <span className="flex h-10 items-center">Proveedor</span>
              <span className="flex h-10 items-center justify-end">Disp.</span>
              <span className="flex h-10 items-center justify-end">Mín.</span>
              <span className="flex h-10 items-center">Sugerido</span>
              <span className="flex h-10 items-center">Estado</span>
              <span className="flex h-10 items-center justify-end">Acción</span>
            </div>
            <div className="divide-y divide-row-separator">
              {pageRows.map((row) => {
                const hasOrder = activeOrderBySku.has(row.sku);
                const order = activeOrderBySku.get(row.sku);
                const selected = selectedSkus.has(row.sku);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "grid grid-cols-[28px_minmax(0,1fr)_150px_76px_66px_100px_130px_84px] items-center gap-3 px-5 py-2.5",
                      selected && "bg-primary/[0.06]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={hasOrder}
                      onChange={() => toggleSelected(row.sku)}
                      aria-label={`Seleccionar ${row.sku}`}
                      className="size-3.5 accent-foreground disabled:opacity-30"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{row.productName}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.sku}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{row.primarySupplier ?? "Sin proveedor"}</p>
                      {row.secondarySupplier && (
                        <p className="truncate text-[11px] text-muted-foreground">Alterno: {row.secondarySupplier}</p>
                      )}
                    </div>
                    <p className="text-right text-[13px] font-semibold tabular-nums">
                      {row.hasInventoryRecord ? number.format(row.available) : "—"}
                    </p>
                    <p className="text-right text-[13px] text-muted-foreground tabular-nums">
                      {number.format(row.minimumStock)}
                    </p>
                    <div>
                      {hasOrder ? (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      ) : (
                        <SuggestedStepper
                          value={suggestedFor(row)}
                          onChange={(next) =>
                            setSuggestedOverrides((value) => ({ ...value, [row.sku]: next }))
                          }
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <StatusLabel row={row} activeOrder={order} />
                      {hasOrder && order && (
                        <Link href="/orders" className="mt-0.5 block text-[11px] font-medium text-muted-foreground underline underline-offset-2">
                          {order.orderNumbers.join(" · ")}
                        </Link>
                      )}
                    </div>
                    <div className="flex justify-end gap-0.5">
                      {historySubjects.has(row.sku) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setHistoryItem(historySubjects.get(row.sku) ?? null)}
                          aria-label={`Ver movimientos de ${row.sku}`}
                        >
                          <History className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                      {isAdmin ? (
                        <>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(row)} aria-label={`Editar ${row.sku}`}>
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => remove(row)}
                            disabled={removingId === row.id}
                            aria-label={`Retirar ${row.sku}`}
                          >
                            {removingId === row.id ? (
                              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="divide-y divide-row-separator lg:hidden">
            {pageRows.map((row) => {
              const hasOrder = activeOrderBySku.has(row.sku);
              return (
                <div
                  key={row.id}
                  className={cn(
                    "grid min-h-[60px] grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2",
                    selectedSkus.has(row.sku) && "bg-primary/[0.06]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedSkus.has(row.sku)}
                    disabled={hasOrder}
                    onChange={() => toggleSelected(row.sku)}
                    aria-label={`Seleccionar ${row.sku}`}
                    className="size-4 shrink-0 accent-foreground disabled:opacity-30"
                  />
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => historySubjects.has(row.sku) && setHistoryItem(historySubjects.get(row.sku) ?? null)}
                  >
                    <span className="block truncate text-[13px] font-semibold">{row.productName}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground">
                      {row.sku} · mín. {number.format(row.minimumStock)} · {hasOrder ? "en pedido" : row.hasInventoryRecord ? `${number.format(row.available)} disp.` : "sin registro"}
                    </span>
                  </button>
                  {hasOrder ? (
                    <Link href="/orders" className="text-[11px] font-semibold text-warning underline underline-offset-2">Ver pedido</Link>
                  ) : (
                    <SuggestedStepper
                      value={suggestedFor(row)}
                      onChange={(next) => setSuggestedOverrides((value) => ({ ...value, [row.sku]: next }))}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={CheckCircle2}
                tone="brand"
                title="No hay productos para este filtro"
                description="Prueba otra búsqueda, pestaña o proveedor."
              />
            </div>
          ) : null}
        </CardContent>
        {filtered.length > 0 ? (
          <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {firstVisible}–{lastVisible} de {filtered.length} productos
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior">
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="min-w-20 text-center text-sm font-medium">{safePage} de {pageCount}</span>
              <Button variant="outline" size="icon" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Página siguiente">
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto de recompra" : "Agregar producto de recompra"}</DialogTitle>
            <DialogDescription>
              El mínimo activa la alerta; el máximo determina la cantidad sugerida para el pedido.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="watch-sku">SKU / referencia</FieldLabel>
              <Input id="watch-sku" list="inventory-skus" value={form.sku} disabled={Boolean(editing)} onChange={(event) => changeSku(event.target.value)} />
              <datalist id="inventory-skus">
                {inventoryOptions.map(([sku, name]) => <option key={sku} value={sku}>{name}</option>)}
              </datalist>
            </Field>
            <Field>
              <FieldLabel htmlFor="watch-source">ID de Effi</FieldLabel>
              <Input id="watch-source" type="number" value={form.sourceId} disabled={Boolean(editing)} onChange={(event) => setForm((value) => ({ ...value, sourceId: event.target.value }))} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="watch-name">Nombre del producto</FieldLabel>
              <Input id="watch-name" value={form.productName} disabled={Boolean(editing)} onChange={(event) => setForm((value) => ({ ...value, productName: event.target.value }))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="watch-minimum">Mínimo</FieldLabel>
              <Input id="watch-minimum" type="number" min={0} step={1} value={form.minimumStock} onChange={(event) => setForm((value) => ({ ...value, minimumStock: event.target.value }))} />
              <FieldDescription>Activa la alerta al llegar a este nivel.</FieldDescription>
            </Field>
            <Field data-invalid={Number(form.maximumStock) < Number(form.minimumStock)}>
              <FieldLabel htmlFor="watch-maximum">Máximo</FieldLabel>
              <Input id="watch-maximum" type="number" min={0} step={1} aria-invalid={Number(form.maximumStock) < Number(form.minimumStock)} value={form.maximumStock} onChange={(event) => setForm((value) => ({ ...value, maximumStock: event.target.value }))} />
              <FieldError>{Number(form.maximumStock) < Number(form.minimumStock) ? "Debe ser igual o mayor al mínimo." : null}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="watch-primary-supplier">Proveedor principal</FieldLabel>
              <Input id="watch-primary-supplier" list="supplier-options" value={form.primarySupplier} onChange={(event) => setForm((value) => ({ ...value, primarySupplier: event.target.value }))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="watch-secondary-supplier">Proveedor secundario</FieldLabel>
              <Input id="watch-secondary-supplier" list="supplier-options" value={form.secondarySupplier} onChange={(event) => setForm((value) => ({ ...value, secondarySupplier: event.target.value }))} />
              <datalist id="supplier-options">
                {supplierOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="watch-notes">Notas</FieldLabel>
              <Input id="watch-notes" value={form.notes} placeholder="Presentación, condición o contacto" onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <PackagePlus data-icon="inline-start" aria-hidden="true" />}
              {saving ? "Guardando…" : "Guardar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductHistorySheet item={historyItem} open={Boolean(historyItem)} onOpenChange={(open) => { if (!open) setHistoryItem(null); }} />
    </div>
  );
}
