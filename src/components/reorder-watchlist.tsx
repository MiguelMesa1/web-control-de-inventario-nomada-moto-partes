"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Search,
  ShoppingCart,
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
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";
import {
  buildActiveOrderBySku,
  type ActiveOrderSummary,
} from "@/lib/orders/active-orders";
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

function statusBadge(
  row: ReorderAlertRow,
  activeOrder?: ActiveOrderSummary,
) {
  if (activeOrder?.status === "ordered") {
    return (
      <Badge variant="outline" className="gap-1 border-chart-2/45 bg-chart-2/10">
        <Truck className="size-3" aria-hidden="true" />
        Pedido en curso
      </Badge>
    );
  }
  if (activeOrder?.status === "draft") {
    return (
      <Badge variant="outline" className="gap-1 border-primary/60 bg-primary/10">
        <ClipboardCheck className="size-3" aria-hidden="true" />
        En borrador
      </Badge>
    );
  }
  if (row.status === "missing") return <Badge variant="outline">Sin registro</Badge>;
  if (row.status === "exhausted") return <Badge variant="destructive">Agotado</Badge>;
  if (row.status === "low") return <Badge>Por reponer</Badge>;
  return <Badge variant="secondary">Nivel estable</Badge>;
}

function ActiveOrderDetails({ order }: { order: ActiveOrderSummary }) {
  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      <p>
        <span className="font-semibold text-foreground">
          {number.format(order.quantity)} {order.quantity === 1 ? "unidad" : "unidades"}
        </span>{" "}
        con {order.supplierNames.join(", ")}
      </p>
      <p>{order.orderNumbers.join(" · ")}</p>
    </div>
  );
}

function ReplenishmentLevels({ row }: { row: ReorderAlertRow }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3 text-center">
      <div>
        <p className="text-xs text-muted-foreground">Disponible</p>
        <p className="font-bold tabular-nums">
          {row.hasInventoryRecord ? number.format(row.available) : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Mínimo</p>
        <p className="font-bold tabular-nums">{number.format(row.minimumStock)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Máximo</p>
        <p className="font-bold tabular-nums">{number.format(row.maximumStock)}</p>
      </div>
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
  const [status, setStatus] = useState("attention");
  const [supplier, setSupplier] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReorderWatchItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<ProductHistorySubject | null>(null);
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

  const filtered = useMemo(() => {
    const normalized = normalizeInventoryText(deferredQuery);
    return rows.filter((row) => {
      const matchesQuery =
        !normalized ||
        normalizeInventoryText(row.sku).includes(normalized) ||
        normalizeInventoryText(row.productName).includes(normalized);
      const matchesStatus =
        status === "all" ||
        (status === "attention" && row.status !== "healthy") ||
        (status === "in-progress" &&
          activeOrderBySku.get(row.sku)?.status === "ordered") ||
        row.status === status;
      const matchesSupplier =
        supplier === "all" ||
        row.primarySupplier === supplier ||
        row.secondarySupplier === supplier;
      return matchesQuery && matchesStatus && matchesSupplier;
    });
  }, [activeOrderBySku, deferredQuery, rows, status, supplier]);

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
        eyebrow="Abastecimiento"
        title="Recompra"
        description="Las alertas se activan al llegar al mínimo y la compra sugerida completa existencias hasta el máximo."
        icon={ShoppingCart}
        action={
          <Button asChild>
            <Link href="/orders">
              <Truck data-icon="inline-start" aria-hidden="true" />
              Preparar pedidos
            </Link>
          </Button>
        }
      />

      {metrics.attention > 0 ? (
        <Alert className="border-primary/60 bg-primary/10">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>
            {metrics.attention} {metrics.attention === 1 ? "producto pendiente" : "productos pendientes"} por pedir
          </AlertTitle>
          <AlertDescription>
            Para completar sus máximos se sugieren {number.format(metrics.suggested)} unidades.
          </AlertDescription>
        </Alert>
      ) : null}

      {metrics.inProgress > 0 ? (
        <Alert className="border-chart-2/40 bg-chart-2/10">
          <Truck aria-hidden="true" />
          <AlertTitle>
            {metrics.inProgress} {metrics.inProgress === 1 ? "producto tiene" : "productos tienen"} un pedido en curso
          </AlertTitle>
          <AlertDescription>
            Ya están solicitados y no se incluyen nuevamente en las unidades por pedir.{' '}
            <Link href="/orders" className="font-semibold underline underline-offset-4">
              Ver seguimiento
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen de recompra">
        {[
          ["Productos configurados", metrics.monitored],
          ["Pendientes por pedir", metrics.attention],
          ["Agotados", metrics.exhausted],
          ["Pedidos en curso", metrics.inProgress],
          ["Unidades por pedir", metrics.suggested],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="font-display text-3xl tabular-nums">
                {number.format(Number(value))}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por producto o referencia…"
                className="pl-10"
                aria-label="Buscar productos de recompra"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="attention">Por debajo del mínimo</SelectItem>
                  <SelectItem value="in-progress">Pedidos en curso</SelectItem>
                  <SelectItem value="low">Necesitan reposición</SelectItem>
                  <SelectItem value="exhausted">Agotados</SelectItem>
                  <SelectItem value="missing">Sin registro</SelectItem>
                  <SelectItem value="healthy">Nivel estable</SelectItem>
                  <SelectItem value="all">Todos los estados</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              value={supplier}
              onValueChange={(value) => {
                setSupplier(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filtrar por proveedor">
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
        </CardHeader>
        <CardContent>
          <div className="hidden lg:block">
            <Table aria-label="Productos configurados para recompra">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Máximo</TableHead>
                  <TableHead className="text-right">Sugerido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-md">
                      <p className="font-semibold leading-snug">{row.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.sku}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{row.primarySupplier ?? "Sin proveedor"}</p>
                      {row.secondarySupplier ? (
                        <p className="mt-1 text-xs text-muted-foreground">Alterno: {row.secondarySupplier}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {row.hasInventoryRecord ? number.format(row.available) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{number.format(row.minimumStock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{number.format(row.maximumStock)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {activeOrderBySku.has(row.sku)
                        ? "—"
                        : number.format(row.suggestedQuantity)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-44">
                        {statusBadge(row, activeOrderBySku.get(row.sku))}
                        {activeOrderBySku.has(row.sku) ? (
                          <>
                            <ActiveOrderDetails order={activeOrderBySku.get(row.sku)!} />
                            <Link
                              href="/orders"
                              className="mt-2 inline-flex min-h-8 items-center font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4"
                            >
                              Ver seguimiento
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {historySubjects.has(row.sku) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHistoryItem(historySubjects.get(row.sku) ?? null)}
                            aria-label={`Ver movimientos de ${row.sku}`}
                          >
                            <History aria-hidden="true" />
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Editar ${row.sku}`}>
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(row)}
                              disabled={removingId === row.id}
                              aria-label={`Retirar ${row.sku}`}
                            >
                              {removingId === row.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {pageRows.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-snug">{row.productName}</CardTitle>
                      <CardDescription className="mt-1">{row.sku}</CardDescription>
                    </div>
                    {statusBadge(row, activeOrderBySku.get(row.sku))}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ReplenishmentLevels row={row} />
                  {activeOrderBySku.has(row.sku) ? (
                    <div className="rounded-xl border border-chart-2/40 bg-chart-2/10 p-3">
                      <p className="flex items-center gap-2 font-semibold">
                        <Truck className="size-4 text-chart-2" aria-hidden="true" />
                        {activeOrderBySku.get(row.sku)?.status === "ordered"
                          ? "Este producto ya fue solicitado"
                          : "Este producto ya está en un borrador"}
                      </p>
                      <ActiveOrderDetails order={activeOrderBySku.get(row.sku)!} />
                      <Button asChild variant="outline" className="mt-3 min-h-11 w-full bg-background">
                        <Link href="/orders">Ver seguimiento</Link>
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Proveedor principal</p>
                      <p className="font-semibold">{row.primarySupplier ?? "Sin proveedor"}</p>
                      {row.secondarySupplier ? <p className="text-xs text-muted-foreground">Alterno: {row.secondarySupplier}</p> : null}
                    </div>
                    {activeOrderBySku.has(row.sku) ? (
                      <Badge variant="outline">
                        {activeOrderBySku.get(row.sku)?.status === "ordered"
                          ? `${number.format(activeOrderBySku.get(row.sku)!.quantity)} en camino`
                          : "En borrador"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Comprar {number.format(row.suggestedQuantity)}</Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex-wrap gap-2">
                  {historySubjects.has(row.sku) ? (
                    <Button variant="outline" className="flex-1" onClick={() => setHistoryItem(historySubjects.get(row.sku) ?? null)}>
                      <History data-icon="inline-start" aria-hidden="true" />
                      Movimientos
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button variant="outline" className="flex-1" onClick={() => openEdit(row)}>
                      <Pencil data-icon="inline-start" aria-hidden="true" />
                      Editar
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-8 text-center">
              <div>
                <CheckCircle2 className="mx-auto size-9 text-primary" aria-hidden="true" />
                <p className="mt-3 font-semibold">No hay productos para este filtro</p>
                <p className="mt-1 text-sm text-muted-foreground">Prueba otra búsqueda, estado o proveedor.</p>
              </div>
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
