"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";
import type {
  OrdersPageData,
  PurchaseOrder,
  PurchaseOrderStatus,
  ReorderAlertRow,
} from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const orderDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});
const CART_STORAGE_KEY = "nomada:purchase-cart:v1";

type CartItem = {
  sku: string;
  productName: string;
  available: number;
  minimumStock: number;
  maximumStock: number;
  primarySupplier: string;
  secondarySupplier?: string;
  supplierName: string;
  quantity: number;
};

type PurchasePriority = "critical" | "high" | "medium";
type PriorityFilter = "all" | PurchasePriority;

const priorityRank: Record<PurchasePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

function getPurchasePriority(row: ReorderAlertRow): PurchasePriority {
  if (
    row.status === "missing" ||
    row.status === "exhausted" ||
    row.available <= row.minimumStock * 0.25
  ) {
    return "critical";
  }
  if (row.available <= row.minimumStock * 0.6) return "high";
  return "medium";
}

function priorityBadge(priority: PurchasePriority) {
  if (priority === "critical") {
    return <Badge variant="destructive">Crítica</Badge>;
  }
  if (priority === "high") return <Badge>Alta</Badge>;
  return <Badge variant="secondary">Media</Badge>;
}

function readStoredCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).sku === "string" &&
        typeof (item as CartItem).productName === "string" &&
        typeof (item as CartItem).supplierName === "string" &&
        Number.isFinite((item as CartItem).quantity),
    );
  } catch {
    return [];
  }
}

function orderStatus(status: PurchaseOrderStatus) {
  const labels: Record<PurchaseOrderStatus, string> = {
    draft: "Borrador",
    ordered: "Solicitado",
    received: "Recibido",
    cancelled: "Cancelado",
  };
  const variant =
    status === "cancelled"
      ? "destructive"
      : status === "received"
        ? "secondary"
        : status === "draft"
          ? "outline"
          : "default";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}

export function OrdersWorkspace({ data }: { data: OrdersPageData }) {
  const router = useRouter();
  const profile = useProfile();
  const { current, isDemo, purchaseOrders, reorderWatchlist } = data;
  const canEdit = profile.role === "admin" || profile.role === "uploader";
  const [tab, setTab] = useState("prepare");
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [suggestionSuppliers, setSuggestionSuppliers] = useState<
    Record<string, string>
  >({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const deferredManualQuery = useDeferredValue(manualQuery);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(readStoredCart());
      setCartLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, cartLoaded]);

  const rows = useMemo(
    () =>
      buildReorderAlertRows(
        reorderWatchlist.filter((item) => item.active),
        current,
      ),
    [current, reorderWatchlist],
  );
  const attentionRows = useMemo(
    () =>
      rows
        .filter((row) => row.status !== "healthy")
        .sort(
          (a, b) =>
            priorityRank[getPurchasePriority(a)] -
              priorityRank[getPurchasePriority(b)] ||
            a.available - b.available ||
            a.productName.localeCompare(b.productName, "es"),
        ),
    [rows],
  );
  const orderStateBySku = useMemo(
    () => {
      const states = new Map<string, "draft" | "ordered">();
      for (const order of purchaseOrders) {
        if (order.status !== "draft" && order.status !== "ordered") continue;
        for (const item of order.items) {
          if (order.status === "ordered" || !states.has(item.sku)) {
            states.set(item.sku, order.status);
          }
        }
      }
      return states;
    },
    [purchaseOrders],
  );
  const openOrderSkus = useMemo(
    () => new Set(orderStateBySku.keys()),
    [orderStateBySku],
  );
  const cartSkus = useMemo(
    () => new Set(cart.map((item) => item.sku)),
    [cart],
  );
  const suppliers = useMemo(
    () =>
      [
        ...new Set(
          rows.flatMap((row) =>
            [row.primarySupplier, row.secondarySupplier].filter(
              (value): value is string => Boolean(value),
            ),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [rows],
  );
  const filteredSuggestions = useMemo(() => {
    const normalized = normalizeInventoryText(deferredQuery);
    return attentionRows.filter((row) => {
      const matchesQuery =
        !normalized ||
        normalizeInventoryText(row.sku).includes(normalized) ||
        normalizeInventoryText(row.productName).includes(normalized);
      const matchesSupplier =
        supplierFilter === "all" ||
        row.primarySupplier === supplierFilter ||
        row.secondarySupplier === supplierFilter;
      const matchesPriority =
        priorityFilter === "all" ||
        getPurchasePriority(row) === priorityFilter;
      return matchesQuery && matchesSupplier && matchesPriority;
    });
  }, [attentionRows, deferredQuery, priorityFilter, supplierFilter]);
  const manualOptions = useMemo(() => {
    const normalized = normalizeInventoryText(deferredManualQuery);
    return rows
      .filter(
        (row) =>
          !cartSkus.has(row.sku) &&
          (!normalized ||
            normalizeInventoryText(row.sku).includes(normalized) ||
            normalizeInventoryText(row.productName).includes(normalized)),
      )
      .slice(0, 40);
  }, [cartSkus, deferredManualQuery, rows]);
  const cartGroups = useMemo(() => {
    const groups = new Map<string, CartItem[]>();
    for (const item of cart) {
      groups.set(item.supplierName, [...(groups.get(item.supplierName) ?? []), item]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [cart]);
  const totalUnits = cart.reduce((total, item) => total + item.quantity, 0);
  const totalSuggestedUnits = useMemo(
    () =>
      attentionRows.reduce(
        (total, row) => total + Math.ceil(row.suggestedQuantity),
        0,
      ),
    [attentionRows],
  );
  const priorityCounts = useMemo(
    () =>
      attentionRows.reduce<Record<PurchasePriority, number>>(
        (counts, row) => {
          counts[getPurchasePriority(row)] += 1;
          return counts;
        },
        { critical: 0, high: 0, medium: 0 },
      ),
    [attentionRows],
  );
  const requestedCount = useMemo(
    () =>
      attentionRows.filter(
        (row) => orderStateBySku.get(row.sku) === "ordered",
      ).length,
    [attentionRows, orderStateBySku],
  );
  const readySuggestions = useMemo(
    () =>
      filteredSuggestions.filter(
        (row) =>
          !openOrderSkus.has(row.sku) &&
          !cartSkus.has(row.sku) &&
          Boolean(row.primarySupplier || row.secondarySupplier),
      ),
    [cartSkus, filteredSuggestions, openOrderSkus],
  );

  function selectedSupplierFor(row: ReorderAlertRow) {
    const choices = [row.primarySupplier, row.secondarySupplier].filter(
      (value): value is string => Boolean(value),
    );
    const selected = suggestionSuppliers[row.sku];
    if (selected && choices.includes(selected)) return selected;
    if (supplierFilter !== "all" && choices.includes(supplierFilter)) {
      return supplierFilter;
    }
    return choices[0] ?? "Sin proveedor asignado";
  }

  function addToCart(row: ReorderAlertRow, supplierName = selectedSupplierFor(row)) {
    if (cartSkus.has(row.sku)) return;
    const primarySupplier = row.primarySupplier ?? "Sin proveedor asignado";
    setCart((current) => [
      ...current,
      {
        sku: row.sku,
        productName: row.productName,
        available: row.available,
        minimumStock: row.minimumStock,
        maximumStock: row.maximumStock,
        primarySupplier,
        secondarySupplier: row.secondarySupplier,
        supplierName,
        quantity: Math.max(1, Math.ceil(row.suggestedQuantity)),
      },
    ]);
    toast.success("Producto agregado al carrito", {
      description: `${row.sku} · ${supplierName}`,
    });
  }

  function addAllSuggestions() {
    if (!readySuggestions.length) return;
    const additions = readySuggestions.map((row) => {
      const primarySupplier = row.primarySupplier ?? "Sin proveedor asignado";
      return {
        sku: row.sku,
        productName: row.productName,
        available: row.available,
        minimumStock: row.minimumStock,
        maximumStock: row.maximumStock,
        primarySupplier,
        secondarySupplier: row.secondarySupplier,
        supplierName: selectedSupplierFor(row),
        quantity: Math.max(1, Math.ceil(row.suggestedQuantity)),
      };
    });
    setCart((current) => [...current, ...additions]);
    toast.success(`${additions.length} productos agregados al carrito`);
  }

  function updateCartItem(sku: string, patch: Partial<CartItem>) {
    setCart((current) =>
      current.map((item) => (item.sku === sku ? { ...item, ...patch } : item)),
    );
  }

  function removeCartItem(sku: string) {
    setCart((current) => current.filter((item) => item.sku !== sku));
  }

  async function createOrders() {
    if (!cart.length) return;
    if (cart.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      toast.error("Revisa las cantidades del carrito.");
      return;
    }
    if (cart.some((item) => item.supplierName === "Sin proveedor asignado")) {
      toast.error("Todos los productos necesitan un proveedor antes de continuar.");
      return;
    }

    setSaving(true);
    try {
      if (!isDemo) {
        const response = await fetch("/api/purchase-orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orders: cartGroups.map(([supplierName, items]) => ({
              supplierName,
              items: items.map((item) => ({
                sku: item.sku,
                productName: item.productName,
                quantity: item.quantity,
                available: item.available,
                minimumStock: item.minimumStock,
                maximumStock: item.maximumStock,
              })),
            })),
          }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success(
        `${cartGroups.length} ${cartGroups.length === 1 ? "pedido guardado" : "pedidos guardados"}`,
        { description: `${totalUnits} unidades organizadas por proveedor.` },
      );
      setCart([]);
      setTab("history");
      router.refresh();
    } catch (error) {
      toast.error("No pudimos guardar los pedidos", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(order: PurchaseOrder, status: PurchaseOrderStatus) {
    setUpdatingOrderId(order.id);
    try {
      if (!isDemo) {
        const response = await fetch("/api/purchase-orders", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: order.id, status }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success("Estado del pedido actualizado");
      router.refresh();
    } catch (error) {
      toast.error("No pudimos actualizar el pedido", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Gestión de compras"
        title="Pedidos"
        description="Convierte las alertas de reposición en pedidos organizados automáticamente por proveedor."
        icon={ClipboardList}
        action={
          canEdit ? (
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Agregar producto
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-fit">
          <TabsTrigger value="prepare">
            <ShoppingCart className="hidden sm:block" aria-hidden="true" />
            Preparar compra
            {cart.length ? <Badge variant="secondary">{cart.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="history">
            <ClipboardCheck className="hidden sm:block" aria-hidden="true" />
            Pedidos guardados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prepare" className="mt-5">
          {!canEdit ? (
            <Alert>
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Vista de consulta</AlertTitle>
              <AlertDescription>
                Un administrador o cargador puede preparar y guardar pedidos.
              </AlertDescription>
            </Alert>
          ) : null}

          <section
            className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Resumen de preparación"
          >
            {[
              ["Productos por reponer", attentionRows.length],
              ["Unidades sugeridas", totalSuggestedUnits],
              ["En el carrito", cart.length],
              ["Solicitados", requestedCount],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="gap-1">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="font-display text-3xl tabular-nums">{number.format(Number(value))}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>

          <div className="mt-4 grid items-start gap-4 min-[1800px]:grid-cols-[minmax(0,1fr)_25rem]">
            <Card>
              <CardHeader className="gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="font-display text-2xl uppercase">Matriz de prioridad</CardTitle>
                    <CardDescription className="mt-1">Qué pedir primero según las existencias y el mínimo de cada producto.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={addAllSuggestions} disabled={!canEdit || readySuggestions.length === 0}>
                    <PackagePlus data-icon="inline-start" aria-hidden="true" />
                    Agregar visibles ({readySuggestions.length})
                  </Button>
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prioridad de compra
                    </p>
                    {priorityFilter !== "all" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPriorityFilter("all")}
                      >
                        Ver todas
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      aria-pressed={priorityFilter === "critical"}
                      onClick={() =>
                        setPriorityFilter((current) =>
                          current === "critical" ? "all" : "critical",
                        )
                      }
                      className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-left transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-destructive"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive text-destructive-foreground">
                        <AlertTriangle className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-bold text-destructive">
                          Crítica
                          <Badge variant="destructive">{priorityCounts.critical}</Badge>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Pedir hoy
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={priorityFilter === "high"}
                      onClick={() =>
                        setPriorityFilter((current) =>
                          current === "high" ? "all" : "high",
                        )
                      }
                      className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 p-3 text-left transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-primary"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                        <TrendingUp className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-bold">
                          Alta
                          <Badge>{priorityCounts.high}</Badge>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Pedir esta semana
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={priorityFilter === "medium"}
                      onClick={() =>
                        setPriorityFilter((current) =>
                          current === "medium" ? "all" : "medium",
                        )
                      }
                      className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border bg-muted/40 p-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground/50"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-foreground shadow-sm ring-1 ring-border">
                        <Clock3 className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-bold">
                          Media
                          <Badge variant="secondary">{priorityCounts.medium}</Badge>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Programar compra
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto o referencia…" className="pl-10" aria-label="Buscar sugerencias de compra" />
                  </div>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger aria-label="Filtrar sugerencias por proveedor"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        {suppliers.map((supplier) => <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSuggestions.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border bg-card">
                    <div className="hidden grid-cols-[minmax(11rem,1.4fr)_4.25rem_4.25rem_5.25rem_minmax(10rem,1fr)_6rem_8.5rem] gap-3 border-b bg-foreground px-4 py-3 text-xs font-semibold uppercase tracking-wide text-background xl:grid">
                      <span>Producto</span>
                      <span className="text-center">Stock</span>
                      <span className="text-center">Mínimo</span>
                      <span className="text-center">A pedir</span>
                      <span>Proveedor</span>
                      <span className="text-center">Prioridad</span>
                      <span className="text-center">Estado</span>
                    </div>
                    <div role="list">
                      {filteredSuggestions.map((row) => {
                        const inCart = cartSkus.has(row.sku);
                        const orderState = orderStateBySku.get(row.sku);
                        const inOrder = Boolean(orderState);
                        const priority = getPurchasePriority(row);
                        const supplierChoices = [
                          ...new Set(
                            [row.primarySupplier, row.secondarySupplier].filter(
                              (value): value is string => Boolean(value),
                            ),
                          ),
                        ];
                        const selectedSupplier = selectedSupplierFor(row);
                        const hasAssignedSupplier =
                          selectedSupplier !== "Sin proveedor asignado";

                        return (
                          <div
                            key={row.id}
                            role="listitem"
                            className={`grid grid-cols-3 gap-3 border-b p-4 last:border-b-0 [contain-intrinsic-size:128px] [content-visibility:auto] transition-colors hover:bg-muted/25 xl:grid-cols-[minmax(11rem,1.4fr)_4.25rem_4.25rem_5.25rem_minmax(10rem,1fr)_6rem_8.5rem] xl:items-center ${
                              orderState === "ordered"
                                ? "bg-emerald-500/[0.04]"
                                : inCart
                                  ? "bg-primary/[0.04]"
                                  : ""
                            }`}
                          >
                            <div className="col-span-3 min-w-0 xl:col-auto">
                              <div className="flex flex-wrap items-start gap-2">
                                <p className="font-semibold leading-snug">
                                  {row.productName}
                                </p>
                                {row.status === "missing" ? (
                                  <Badge variant="outline">Sin registro</Badge>
                                ) : row.status === "exhausted" ? (
                                  <Badge variant="destructive">Agotado</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.sku} · Máximo {number.format(row.maximumStock)}
                              </p>
                            </div>

                            <div className="rounded-lg bg-muted/45 p-2 text-center xl:bg-transparent xl:p-0">
                              <p className="text-xs text-muted-foreground xl:hidden">
                                Stock
                              </p>
                              <p
                                className={`font-bold tabular-nums ${
                                  row.available <= 0 ? "text-destructive" : ""
                                }`}
                              >
                                {row.hasInventoryRecord
                                  ? number.format(row.available)
                                  : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/45 p-2 text-center xl:bg-transparent xl:p-0">
                              <p className="text-xs text-muted-foreground xl:hidden">
                                Mínimo
                              </p>
                              <p className="font-bold tabular-nums">
                                {number.format(row.minimumStock)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/45 p-2 text-center xl:bg-transparent xl:p-0">
                              <p className="text-xs text-muted-foreground xl:hidden">
                                A pedir
                              </p>
                              <p className="font-bold tabular-nums">
                                {number.format(row.suggestedQuantity)}
                              </p>
                            </div>

                            <Field className="col-span-3 xl:col-auto">
                              <FieldLabel
                                className="xl:sr-only"
                                htmlFor={`suggestion-supplier-${row.sku}`}
                              >
                                Proveedor para el pedido
                              </FieldLabel>
                              <Select
                                value={selectedSupplier}
                                onValueChange={(value) =>
                                  setSuggestionSuppliers((current) => ({
                                    ...current,
                                    [row.sku]: value,
                                  }))
                                }
                                disabled={
                                  !canEdit ||
                                  inCart ||
                                  inOrder ||
                                  supplierChoices.length < 2
                                }
                              >
                                <SelectTrigger
                                  id={`suggestion-supplier-${row.sku}`}
                                  className="min-h-11 xl:min-h-10"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {supplierChoices.length ? (
                                      supplierChoices.map((choice) => (
                                        <SelectItem key={choice} value={choice}>
                                          {choice}
                                          {choice === row.primarySupplier
                                            ? " · principal"
                                            : " · secundario"}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem
                                        value="Sin proveedor asignado"
                                        disabled
                                      >
                                        Sin proveedor asignado
                                      </SelectItem>
                                    )}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              <FieldDescription className="xl:hidden">
                                {supplierChoices.length > 1
                                  ? "Puedes elegir el proveedor alterno antes de agregar."
                                  : hasAssignedSupplier
                                    ? "Único proveedor configurado."
                                    : "Configura un proveedor en Recompra."}
                              </FieldDescription>
                            </Field>

                            <div className="flex items-center xl:justify-center">
                              {priorityBadge(priority)}
                            </div>
                            <div className="col-span-2 xl:col-auto">
                              {orderState === "ordered" ? (
                                <Button
                                  variant="outline"
                                  className="min-h-11 w-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700 disabled:opacity-100 dark:text-emerald-300"
                                  disabled
                                >
                                  <PackageCheck
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                  />
                                  Solicitado
                                </Button>
                              ) : orderState === "draft" ? (
                                <Button
                                  variant="outline"
                                  className="min-h-11 w-full disabled:opacity-100"
                                  disabled
                                >
                                  <ClipboardCheck
                                    data-icon="inline-start"
                                    aria-hidden="true"
                                  />
                                  En borrador
                                </Button>
                              ) : inCart ? (
                                <Button
                                  variant="secondary"
                                  className="min-h-11 w-full disabled:opacity-100"
                                  disabled
                                >
                                  <Check data-icon="inline-start" aria-hidden="true" />
                                  En carrito
                                </Button>
                              ) : (
                              <Button
                                className="min-h-11 w-full"
                                disabled={
                                  !canEdit || inOrder || !hasAssignedSupplier
                                }
                                onClick={() => addToCart(row, selectedSupplier)}
                              >
                                <ShoppingCart
                                  data-icon="inline-start"
                                  aria-hidden="true"
                                />
                                Agregar
                              </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {filteredSuggestions.length === 0 ? (
                  <div className="grid min-h-52 place-items-center rounded-xl border border-dashed p-8 text-center">
                    <div><CheckCircle2 className="mx-auto size-9 text-primary" aria-hidden="true" /><p className="mt-3 font-semibold">No hay sugerencias para este filtro</p><p className="mt-1 text-sm text-muted-foreground">Prueba otro proveedor o agrega un producto manualmente.</p></div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card
              id="purchase-cart"
              className="min-[1800px]:sticky min-[1800px]:top-24"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl uppercase">Carrito de compra</CardTitle>
                    <CardDescription className="mt-1">
                      {cart.length} {cart.length === 1 ? "producto" : "productos"} · {number.format(totalUnits)} {totalUnits === 1 ? "unidad" : "unidades"}
                    </CardDescription>
                  </div>
                  <Badge>{cartGroups.length} {cartGroups.length === 1 ? "proveedor" : "proveedores"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex max-h-[58vh] flex-col gap-4 overflow-y-auto pr-1">
                  {cartGroups.map(([supplierName, items], groupIndex) => (
                    <div key={supplierName} className="flex flex-col gap-3">
                      {groupIndex > 0 ? <Separator /> : null}
                      <div className="flex items-center gap-2"><Truck className="size-4 text-primary" aria-hidden="true" /><p className="font-semibold">{supplierName}</p><Badge variant="outline">{items.length}</Badge></div>
                      {items.map((item) => {
                        const supplierChoices = [item.primarySupplier, item.secondarySupplier].filter((value): value is string => Boolean(value));
                        return (
                          <div key={item.sku} className="rounded-xl border bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0"><p className="text-sm font-semibold leading-snug">{item.productName}</p><p className="mt-1 text-xs text-muted-foreground">{item.sku}</p></div>
                              <Button variant="ghost" size="icon" onClick={() => removeCartItem(item.sku)} aria-label={`Quitar ${item.sku} del carrito`}><Trash2 aria-hidden="true" /></Button>
                            </div>
                            <FieldGroup className="mt-3 gap-3">
                              <Field>
                                <FieldLabel htmlFor={`supplier-${item.sku}`}>Proveedor</FieldLabel>
                                <Select value={item.supplierName} onValueChange={(value) => updateCartItem(item.sku, { supplierName: value })}>
                                  <SelectTrigger id={`supplier-${item.sku}`}><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectGroup>{supplierChoices.map((choice) => <SelectItem key={choice} value={choice}>{choice}{choice === item.primarySupplier ? " · principal" : " · secundario"}</SelectItem>)}</SelectGroup></SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel htmlFor={`quantity-${item.sku}`}>Cantidad</FieldLabel>
                                <Input id={`quantity-${item.sku}`} type="number" min={1} step={1} value={item.quantity} onChange={(event) => updateCartItem(item.sku, { quantity: Math.max(1, Math.round(Number(event.target.value) || 1)) })} />
                                <FieldDescription>Sugerido para llegar a {number.format(item.maximumStock)}.</FieldDescription>
                              </Field>
                            </FieldGroup>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {!cartLoaded ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando carrito…</p> : null}
                  {cartLoaded && cart.length === 0 ? (
                    <div className="py-8 text-center"><ShoppingCart className="mx-auto size-9 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-semibold">Tu carrito está vacío</p><p className="mt-1 text-sm text-muted-foreground">Agrega sugerencias o busca otra referencia.</p></div>
                  ) : null}
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2 border-t pt-5 sm:pt-6">
                <Button className="w-full" onClick={createOrders} disabled={!canEdit || !cart.length || saving}>
                  {saving ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <ClipboardCheck data-icon="inline-start" aria-hidden="true" />}
                  {saving ? "Guardando pedidos…" : `Crear ${cartGroups.length || ""} ${cartGroups.length === 1 ? "pedido" : "pedidos"}`}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Se creará un borrador independiente por proveedor.</p>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {purchaseOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div><CardTitle className="font-display text-xl uppercase">{order.orderNumber}</CardTitle><CardDescription className="mt-1">{order.supplierName} · {orderDate.format(new Date(order.createdAt))}</CardDescription></div>
                    {orderStatus(order.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border bg-muted/20 p-3">
                        <div className="min-w-0"><p className="text-sm font-semibold leading-snug">{item.productName}</p><p className="mt-1 text-xs text-muted-foreground">{item.sku}</p></div>
                        <Badge variant="outline">{number.format(item.quantity)} uds.</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
                {canEdit && (order.status === "draft" || order.status === "ordered") ? (
                  <CardFooter className="flex-wrap gap-2 border-t pt-5 sm:pt-6">
                    {order.status === "draft" ? (
                      <Button onClick={() => updateOrderStatus(order, "ordered")} disabled={updatingOrderId === order.id}>
                        {updatingOrderId === order.id ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <Truck data-icon="inline-start" aria-hidden="true" />}
                        Marcar como solicitado
                      </Button>
                    ) : (
                      <Button onClick={() => updateOrderStatus(order, "received")} disabled={updatingOrderId === order.id}>
                        {updatingOrderId === order.id ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" /> : <CheckCircle2 data-icon="inline-start" aria-hidden="true" />}
                        Marcar recibido
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => updateOrderStatus(order, "cancelled")} disabled={updatingOrderId === order.id}>
                      <X data-icon="inline-start" aria-hidden="true" />
                      Cancelar
                    </Button>
                  </CardFooter>
                ) : null}
              </Card>
            ))}
          </div>
          {purchaseOrders.length === 0 ? (
            <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><ClipboardList className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><p className="mt-4 font-semibold">Aún no hay pedidos guardados</p><p className="mt-1 text-sm text-muted-foreground">Prepara el carrito y crea el primer borrador por proveedor.</p><Button className="mt-5" onClick={() => setTab("prepare")}><ShoppingCart data-icon="inline-start" aria-hidden="true" />Preparar compra</Button></div></CardContent></Card>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar producto al pedido</DialogTitle>
            <DialogDescription>Busca cualquier producto de recompra, aunque todavía no esté bajo el mínimo.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input autoFocus value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="Nombre o referencia…" className="pl-10" aria-label="Buscar producto para agregar al pedido" />
          </div>
          <div className="grid gap-2">
            {manualOptions.map((row) => (
              <button key={row.id} type="button" className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { addToCart(row); setManualOpen(false); setManualQuery(""); }}>
                <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{row.productName}</span><span className="mt-1 block text-xs text-muted-foreground">{row.sku} · {row.primarySupplier ?? "Sin proveedor"}</span></span>
                <Plus className="size-5 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
          {manualOptions.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No encontramos productos disponibles para agregar.</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
