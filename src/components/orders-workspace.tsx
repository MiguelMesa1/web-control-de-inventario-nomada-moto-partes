"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FilterX,
  LoaderCircle,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import { normalizeInventoryText } from "@/lib/inventory/priority-lines";
import {
  buildActiveOrderBySku,
  type ActiveOrderSummary,
} from "@/lib/orders/active-orders";
import { purchaseCartStorageKey } from "@/lib/orders/cart-storage";
import { cn } from "@/lib/utils";
import type {
  OrdersPageData,
  PurchaseOrder,
  PurchaseOrdersPageInfo,
  PurchaseOrderStatus,
  ReorderAlertRow,
} from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const orderDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});
const LEGACY_CART_STORAGE_KEY = "nomada:purchase-cart:v1";
const MAX_ORDER_QUANTITY = 999_999;
const MAX_SUPPLIER_ORDERS = 20;

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
type OrderFilter = "all" | PurchaseOrderStatus;

function mergePurchaseOrders(
  current: PurchaseOrder[],
  incoming: PurchaseOrder[],
) {
  const ordersById = new Map(current.map((order) => [order.id, order]));
  for (const order of incoming) ordersById.set(order.id, order);
  return [...ordersById.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

const priorityRank: Record<PurchasePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const priorityCopy = {
  critical: {
    label: "Pedir hoy",
    description: "Riesgo alto de quedarse sin existencias",
    icon: AlertTriangle,
  },
  high: {
    label: "Esta semana",
    description: "Conviene reponer pronto",
    icon: TrendingUp,
  },
  medium: {
    label: "Programar",
    description: "Puede incluirse en la siguiente compra",
    icon: Clock3,
  },
} satisfies Record<
  PurchasePriority,
  { label: string; description: string; icon: typeof AlertTriangle }
>;

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
  const Icon = priorityCopy[priority].icon;
  return (
    <Badge
      variant={
        priority === "critical"
          ? "destructive"
          : priority === "high"
            ? "default"
            : "outline"
      }
      className="gap-1.5"
    >
      <Icon className="size-3" aria-hidden="true" />
      {priorityCopy[priority].label}
    </Badge>
  );
}

function orderStatus(status: PurchaseOrderStatus) {
  const labels: Record<PurchaseOrderStatus, string> = {
    draft: "Borrador",
    ordered: "Pedido en curso",
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readStoredCart(storageKey: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((candidate) => {
      if (typeof candidate !== "object" || candidate === null) return [];
      const item = candidate as Partial<CartItem>;
      if (
        typeof item.sku !== "string" ||
        typeof item.productName !== "string" ||
        typeof item.primarySupplier !== "string" ||
        typeof item.supplierName !== "string" ||
        !isFiniteNumber(item.available) ||
        !isFiniteNumber(item.minimumStock) ||
        !isFiniteNumber(item.maximumStock) ||
        !isFiniteNumber(item.quantity)
      ) {
        return [];
      }

      return [
        {
          ...item,
          secondarySupplier:
            typeof item.secondarySupplier === "string"
              ? item.secondarySupplier
              : undefined,
          quantity: Math.min(
            MAX_ORDER_QUANTITY,
            Math.max(1, Math.round(item.quantity)),
          ),
        } as CartItem,
      ];
    });
  } catch {
    return [];
  }
}

function stockProgress(row: ReorderAlertRow) {
  if (row.maximumStock <= 0 || !row.hasInventoryRecord) return 0;
  return Math.max(0, Math.min(100, (row.available / row.maximumStock) * 100));
}

function reconcileStoredCart(
  storedCart: CartItem[],
  rowBySku: Map<string, ReorderAlertRow>,
  openOrderSkus: Set<string>,
) {
  return storedCart.flatMap((item) => {
    const row = rowBySku.get(item.sku);
    if (!row || openOrderSkus.has(item.sku)) return [];
    const supplierChoices = [row.primarySupplier, row.secondarySupplier].filter(
      (value): value is string => Boolean(value),
    );
    const supplierName = supplierChoices.includes(item.supplierName)
      ? item.supplierName
      : supplierChoices[0] ?? "Sin proveedor asignado";
    return [
      {
        ...item,
        productName: row.productName,
        available: row.available,
        minimumStock: row.minimumStock,
        maximumStock: row.maximumStock,
        primarySupplier: row.primarySupplier ?? "Sin proveedor asignado",
        secondarySupplier: row.secondarySupplier,
        supplierName,
      },
    ];
  });
}

function PriorityFilterBar({
  value,
  counts,
  total,
  onChange,
}: {
  value: PriorityFilter;
  counts: Record<PurchasePriority, number>;
  total: number;
  onChange: (value: PriorityFilter) => void;
}) {
  const options: Array<{
    value: PriorityFilter;
    label: string;
    count: number;
    icon: typeof AlertTriangle;
  }> = [
    { value: "all", label: "Todos", count: total, icon: ClipboardList },
    {
      value: "critical",
      label: "Pedir hoy",
      count: counts.critical,
      icon: AlertTriangle,
    },
    {
      value: "high",
      label: "Esta semana",
      count: counts.high,
      icon: TrendingUp,
    },
    {
      value: "medium",
      label: "Programar",
      count: counts.medium,
      icon: Clock3,
    },
  ];

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(nextValue) =>
        onChange((nextValue || "all") as PriorityFilter)
      }
      className="flex-wrap justify-start"
      aria-label="Filtrar por urgencia de compra"
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              "min-h-11 rounded-xl px-3",
              option.value === "critical" &&
                "data-[state=on]:border-destructive/50 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive",
            )}
            aria-label={`${option.label}: ${option.count} productos`}
          >
            <Icon aria-hidden="true" />
            <span>{option.label}</span>
            <Badge
              variant={option.value === "critical" ? "destructive" : "secondary"}
            >
              {option.count}
            </Badge>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

const PurchaseProductRow = memo(function PurchaseProductRow({
  row,
  selectedSupplier,
  inCart,
  activeOrder,
  canEdit,
  onSupplierChange,
  onAdd,
  onReviewCart,
  onOpenTracking,
}: {
  row: ReorderAlertRow;
  selectedSupplier: string;
  inCart: boolean;
  activeOrder?: ActiveOrderSummary;
  canEdit: boolean;
  onSupplierChange: (sku: string, supplier: string) => void;
  onAdd: (row: ReorderAlertRow, supplier: string) => void;
  onReviewCart: () => void;
  onOpenTracking: () => void;
}) {
  const priority = getPurchasePriority(row);
  const supplierChoices = [
    ...new Set(
      [row.primarySupplier, row.secondarySupplier].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  const hasSupplier = selectedSupplier !== "Sin proveedor asignado";
  const suggestedQuantity = Math.max(1, Math.ceil(row.suggestedQuantity));

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-4 transition-[border-color,background-color,box-shadow] duration-200 sm:p-5",
        "hover:border-foreground/20 hover:shadow-sm",
        inCart && "border-primary/55 bg-primary/[0.035]",
        activeOrder?.status === "ordered" &&
          "border-chart-2/40 bg-chart-2/[0.04]",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-3 left-0 w-1 rounded-r-full",
          priority === "critical"
            ? "bg-destructive"
            : priority === "high"
              ? "bg-primary"
              : "bg-muted-foreground/35",
        )}
        aria-hidden="true"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(12rem,0.85fr)_8.5rem] lg:items-center">
        <div className="min-w-0 pl-1">
          <div className="flex flex-wrap items-center gap-2">
            {activeOrder?.status === "ordered" ? (
              <Badge variant="outline" className="border-chart-2/45 bg-chart-2/10">
                <Truck className="size-3" aria-hidden="true" />
                Pedido en curso
              </Badge>
            ) : activeOrder?.status === "draft" ? (
              <Badge variant="outline">
                <ClipboardCheck className="size-3" aria-hidden="true" />
                Borrador preparado
              </Badge>
            ) : (
              priorityBadge(priority)
            )}
            {row.status === "missing" ? (
              <Badge variant="outline">Sin registro</Badge>
            ) : row.status === "exhausted" ? (
              <Badge variant="destructive">Agotado</Badge>
            ) : null}
          </div>
          <h3 className="mt-2 font-semibold leading-snug">{row.productName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Ref. {row.sku}</p>

          <div className="mt-3">
            <Progress
              value={stockProgress(row)}
              className={cn(
                "h-1.5 bg-muted",
                priority === "critical" && "[&>div]:bg-destructive",
                priority === "medium" && "[&>div]:bg-muted-foreground",
              )}
              aria-label={`Nivel de inventario de ${row.productName}`}
            />
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Disponible</dt>
                <dd
                  className={cn(
                    "mt-0.5 font-bold tabular-nums",
                    row.available <= 0 && "text-destructive",
                  )}
                >
                  {row.hasInventoryRecord ? number.format(row.available) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mínimo</dt>
                <dd className="mt-0.5 font-bold tabular-nums">
                  {number.format(row.minimumStock)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Meta</dt>
                <dd className="mt-0.5 font-bold tabular-nums">
                  {number.format(row.maximumStock)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {activeOrder ? (
          <div
            className={cn(
              "grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:col-span-2",
              activeOrder.status === "ordered"
                ? "border-chart-2/35 bg-chart-2/10"
                : "bg-muted/35",
            )}
          >
            <div>
              <p className="font-semibold">
                {activeOrder.status === "ordered"
                  ? "Este producto ya está pedido"
                  : "Este producto ya está en un borrador"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {number.format(activeOrder.quantity)} unidades ·{" "}
                {activeOrder.supplierNames.join(", ")}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {activeOrder.orderNumbers.join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeOrder.status === "ordered"
                  ? "No se puede volver a pedir hasta confirmar que llegó o cancelar el pedido."
                  : "Confirma el pedido o cancela el borrador antes de volver a agregarlo."}
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={onOpenTracking}
            >
              <ClipboardList data-icon="inline-start" aria-hidden="true" />
              Ver seguimiento
            </Button>
          </div>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor={`suggestion-supplier-${row.sku}`}>
                Proveedor para este pedido
              </FieldLabel>
              <Select
                value={selectedSupplier}
                onValueChange={(value) => onSupplierChange(row.sku, value)}
                disabled={!canEdit || inCart || supplierChoices.length < 2}
              >
                <SelectTrigger id={`suggestion-supplier-${row.sku}`}>
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
                            : " · alterno"}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Sin proveedor asignado" disabled>
                        Sin proveedor asignado
                      </SelectItem>
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription
                className={cn(!hasSupplier && "font-medium text-destructive")}
              >
                {!hasSupplier
                  ? "Asigna un proveedor en Recompra para poder agregarlo."
                  : supplierChoices.length > 1
                    ? "Puedes cambiarlo antes de agregar."
                    : "Proveedor configurado para este producto."}
              </FieldDescription>
            </Field>

            <div className="flex flex-col gap-2 lg:items-stretch">
              <div className="flex items-end justify-between gap-3 lg:block lg:text-center">
                <p className="text-xs text-muted-foreground">
                  Cantidad sugerida
                </p>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {number.format(suggestedQuantity)}
                </p>
              </div>
              {inCart ? (
                <Button variant="outline" onClick={onReviewCart}>
                  <Check data-icon="inline-start" aria-hidden="true" />
                  Revisar
                </Button>
              ) : (
                <Button
                  disabled={!canEdit || !hasSupplier}
                  onClick={() => onAdd(row, selectedSupplier)}
                >
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Agregar
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
});

function CartItemsList({
  cartGroups,
  cartLoaded,
  idPrefix,
  onUpdate,
  onRemove,
}: {
  cartGroups: Array<[string, CartItem[]]>;
  cartLoaded: boolean;
  idPrefix: string;
  onUpdate: (sku: string, patch: Partial<CartItem>) => void;
  onRemove: (sku: string) => void;
}) {
  if (!cartLoaded) {
    return (
      <div className="grid min-h-40 place-items-center text-center">
        <div>
          <LoaderCircle
            className="mx-auto size-6 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Recuperando tu pedido…
          </p>
        </div>
      </div>
    );
  }

  if (cartGroups.length === 0) {
    return (
      <div className="grid min-h-52 place-items-center px-4 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <ShoppingCart aria-hidden="true" />
          </span>
          <p className="mt-4 font-semibold">Tu pedido está vacío</p>
          <p className="mt-1 max-w-60 text-sm leading-relaxed text-muted-foreground">
            Agrega un producto de la lista y podrás revisar aquí cantidades y
            proveedores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {cartGroups.map(([supplierName, items], groupIndex) => (
        <section key={supplierName} className="flex flex-col gap-3">
          {groupIndex > 0 ? <Separator /> : null}
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-foreground">
              <Truck aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{supplierName}</p>
              <p className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </p>
            </div>
            <Badge variant="outline">1 borrador</Badge>
          </div>

          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const supplierChoices = [
                ...new Set(
                  [item.primarySupplier, item.secondarySupplier].filter(
                    (value): value is string =>
                      Boolean(value) && value !== "Sin proveedor asignado",
                  ),
                ),
              ];
              return (
                <div
                  key={item.sku}
                  className="rounded-xl border bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ref. {item.sku}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(item.sku)}
                      aria-label={`Quitar ${item.productName} del pedido`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>

                  <FieldGroup className="mt-3 gap-3">
                    {supplierChoices.length > 1 ? (
                      <Field>
                        <FieldLabel htmlFor={`${idPrefix}-supplier-${item.sku}`}>
                          Proveedor
                        </FieldLabel>
                        <Select
                          value={item.supplierName}
                          onValueChange={(value) =>
                            onUpdate(item.sku, { supplierName: value })
                          }
                        >
                          <SelectTrigger id={`${idPrefix}-supplier-${item.sku}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {supplierChoices.map((choice) => (
                                <SelectItem key={choice} value={choice}>
                                  {choice}
                                  {choice === item.primarySupplier
                                    ? " · principal"
                                    : " · alterno"}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : null}

                    <Field>
                      <FieldLabel htmlFor={`${idPrefix}-quantity-${item.sku}`}>
                        Cantidad a pedir
                      </FieldLabel>
                      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] overflow-hidden rounded-xl border bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-none"
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            onUpdate(item.sku, {
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          }
                          aria-label={`Restar una unidad de ${item.productName}`}
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <Input
                          id={`${idPrefix}-quantity-${item.sku}`}
                          type="number"
                          min={1}
                          max={MAX_ORDER_QUANTITY}
                          step={1}
                          value={item.quantity}
                          onChange={(event) =>
                            onUpdate(item.sku, {
                              quantity: Math.min(
                                MAX_ORDER_QUANTITY,
                                Math.max(
                                  1,
                                  Math.round(Number(event.target.value) || 1),
                                ),
                              ),
                            })
                          }
                          className="rounded-none border-y-0 text-center font-bold tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-none"
                          disabled={item.quantity >= MAX_ORDER_QUANTITY}
                          onClick={() =>
                            onUpdate(item.sku, {
                              quantity: Math.min(
                                MAX_ORDER_QUANTITY,
                                item.quantity + 1,
                              ),
                            })
                          }
                          aria-label={`Sumar una unidad de ${item.productName}`}
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                      </div>
                      <FieldDescription>
                        Meta configurada: {number.format(item.maximumStock)} unidades.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function CartCheckout({
  cartLength,
  groupCount,
  totalUnits,
  canEdit,
  saving,
  onCreate,
}: {
  cartLength: number;
  groupCount: number;
  totalUnits: number;
  canEdit: boolean;
  saving: boolean;
  onCreate: () => void;
}) {
  const draftLabel = groupCount === 1 ? "borrador" : "borradores";
  return (
    <div className="flex w-full flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted/55 p-2">
          <dt className="text-muted-foreground">Productos</dt>
          <dd className="mt-1 font-bold tabular-nums">{cartLength}</dd>
        </div>
        <div className="rounded-lg bg-muted/55 p-2">
          <dt className="text-muted-foreground">Unidades</dt>
          <dd className="mt-1 font-bold tabular-nums">
            {number.format(totalUnits)}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/55 p-2">
          <dt className="text-muted-foreground">Proveedores</dt>
          <dd className="mt-1 font-bold tabular-nums">{groupCount}</dd>
        </div>
      </dl>
      <Button
        className="w-full"
        onClick={onCreate}
        disabled={!canEdit || !cartLength || saving}
      >
        {saving ? (
          <LoaderCircle
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden="true"
          />
        ) : (
          <ClipboardCheck data-icon="inline-start" aria-hidden="true" />
        )}
        {saving
          ? "Guardando y preparando archivos…"
          : `Guardar ${groupCount || ""} ${draftLabel}`}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Se guardará un borrador y se descargará un Excel por cada proveedor.
      </p>
    </div>
  );
}

function PurchaseCartPanel({
  cartGroups,
  cartLoaded,
  cartLength,
  totalUnits,
  canEdit,
  saving,
  onUpdate,
  onRemove,
  onCreate,
}: {
  cartGroups: Array<[string, CartItem[]]>;
  cartLoaded: boolean;
  cartLength: number;
  totalUnits: number;
  canEdit: boolean;
  saving: boolean;
  onUpdate: (sku: string, patch: Partial<CartItem>) => void;
  onRemove: (sku: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card
      id="purchase-cart"
      className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden"
    >
      <CardHeader className="racing-stripe shrink-0 border-b border-secondary bg-secondary text-secondary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-xl uppercase">
              Pedido en preparación
            </CardTitle>
            <CardDescription className="mt-1 text-secondary-foreground/70">
              Revisa proveedores y cantidades antes de guardar.
            </CardDescription>
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingCart aria-hidden="true" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-4">
        <CartItemsList
          cartGroups={cartGroups}
          cartLoaded={cartLoaded}
          idPrefix="sidebar-cart"
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </CardContent>
      <CardFooter className="shrink-0 border-t bg-card p-4 sm:p-4">
        <CartCheckout
          cartLength={cartLength}
          groupCount={cartGroups.length}
          totalUnits={totalUnits}
          canEdit={canEdit}
          saving={saving}
          onCreate={onCreate}
        />
      </CardFooter>
    </Card>
  );
}

function OrderProgress({ status }: { status: PurchaseOrderStatus }) {
  if (status === "cancelled") {
    return (
      <Alert variant="destructive">
        <X aria-hidden="true" />
        <AlertTitle>Pedido cancelado</AlertTitle>
        <AlertDescription>
          Este pedido ya no continúa dentro del proceso de compra.
        </AlertDescription>
      </Alert>
    );
  }

  const statusIndex = status === "draft" ? 0 : status === "ordered" ? 1 : 2;
  const steps = [
    { label: "Borrador", icon: ClipboardList },
    { label: "Pedido en curso", icon: Truck },
    { label: "Recibido", icon: PackageCheck },
  ];

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progreso del pedido">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCurrent = index === statusIndex;
        const isComplete = index < statusIndex;
        return (
          <li
            key={step.label}
            className={cn(
              "rounded-xl border p-2.5 text-center transition-colors",
              (isCurrent || isComplete) && "border-primary/45 bg-primary/10",
              status === "received" && index === 2 &&
                "border-chart-2/45 bg-chart-2/10",
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <Icon
              className={cn(
                "mx-auto size-4 text-muted-foreground",
                (isCurrent || isComplete) && "text-foreground",
              )}
              aria-hidden="true"
            />
            <p className="mt-1.5 text-xs font-semibold">{step.label}</p>
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
              {isCurrent ? "Estado actual" : isComplete ? "Completado" : "Pendiente"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function PurchaseOrderCard({
  order,
  canEdit,
  updating,
  onUpdateStatus,
  onRequestReceived,
}: {
  order: PurchaseOrder;
  canEdit: boolean;
  updating: boolean;
  onUpdateStatus: (order: PurchaseOrder, status: PurchaseOrderStatus) => void;
  onRequestReceived: (order: PurchaseOrder) => void;
}) {
  const units = order.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <Card>
      <CardHeader className="border-b bg-muted/15">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-xl uppercase">
                {order.supplierName}
              </CardTitle>
              {orderStatus(order.status)}
            </div>
            <CardDescription className="mt-1">
              {order.orderNumber} · {orderDate.format(new Date(order.createdAt))}
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Badge variant="outline">
              {order.items.length} {order.items.length === 1 ? "producto" : "productos"}
            </Badge>
            <Badge variant="outline">{number.format(units)} uds.</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-5 sm:pt-6">
        <OrderProgress status={order.status} />
        <details className="group rounded-xl border bg-muted/15">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            Ver productos del pedido
            <ChevronDown
              className="size-4 transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="flex flex-col gap-2 border-t p-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-lg bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ref. {item.sku}
                  </p>
                </div>
                <Badge variant="outline">{number.format(item.quantity)} uds.</Badge>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
      {canEdit && (order.status === "draft" || order.status === "ordered") ? (
        <CardFooter className="flex-wrap gap-2 border-t pt-5 sm:pt-6">
          {order.status === "draft" ? (
            <Button
              onClick={() => onUpdateStatus(order, "ordered")}
              disabled={updating}
            >
              {updating ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              ) : (
                <Truck data-icon="inline-start" aria-hidden="true" />
              )}
              Confirmar que fue solicitado
            </Button>
          ) : (
            <Button
              onClick={() => onRequestReceived(order)}
              disabled={updating}
            >
              {updating ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
              )}
              Confirmar que llegó
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onUpdateStatus(order, "cancelled")}
            disabled={updating}
          >
            <X data-icon="inline-start" aria-hidden="true" />
            Cancelar pedido
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function OrdersWorkspace({ data }: { data: OrdersPageData }) {
  const router = useRouter();
  const profile = useProfile();
  const {
    current,
    isDemo,
    purchaseOrders: initialPurchaseOrders,
    purchaseOrdersPage: initialPurchaseOrdersPage,
    purchaseOrderCounts: initialPurchaseOrderCounts,
    reorderWatchlist,
  } = data;
  const canEdit = profile.role === "admin" || profile.role === "uploader";
  const [tab, setTab] = useState("prepare");
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [olderPurchaseOrders, setOlderPurchaseOrders] = useState<
    PurchaseOrder[]
  >([]);
  const [purchaseOrdersPageOverride, setPurchaseOrdersPageOverride] =
    useState<PurchaseOrdersPageInfo | null>(null);
  const [orderStatusOverrides, setOrderStatusOverrides] = useState<
    Record<string, PurchaseOrderStatus>
  >({});
  const [loadingOlderOrders, setLoadingOlderOrders] = useState(false);
  const [suggestionSuppliers, setSuggestionSuppliers] = useState<
    Record<string, string>
  >({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [orderToReceive, setOrderToReceive] = useState<PurchaseOrder | null>(
    null,
  );
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const deferredManualQuery = useDeferredValue(manualQuery);
  const cartStorageKey = purchaseCartStorageKey(profile.id);
  const canonicalPurchaseOrders = useMemo(
    () => mergePurchaseOrders(olderPurchaseOrders, initialPurchaseOrders),
    [initialPurchaseOrders, olderPurchaseOrders],
  );
  const purchaseOrders = useMemo(
    () =>
      canonicalPurchaseOrders.map(
        (order) =>
          orderStatusOverrides[order.id]
            ? { ...order, status: orderStatusOverrides[order.id] }
            : order,
      ),
    [canonicalPurchaseOrders, orderStatusOverrides],
  );
  const purchaseOrdersPage =
    purchaseOrdersPageOverride ?? initialPurchaseOrdersPage;

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
  const rowBySku = useMemo(
    () => new Map(rows.map((row) => [row.sku, row])),
    [rows],
  );
  const activeOrderBySku = useMemo(
    () => buildActiveOrderBySku(purchaseOrders),
    [purchaseOrders],
  );
  const openOrderSkus = useMemo(
    () => new Set(activeOrderBySku.keys()),
    [activeOrderBySku],
  );
  const cartSkus = useMemo(() => new Set(cart.map((item) => item.sku)), [cart]);
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
          !openOrderSkus.has(row.sku) &&
          (!normalized ||
            normalizeInventoryText(row.sku).includes(normalized) ||
            normalizeInventoryText(row.productName).includes(normalized)),
      )
      .slice(0, 40);
  }, [cartSkus, deferredManualQuery, openOrderSkus, rows]);
  const cartGroups = useMemo(() => {
    const groups = new Map<string, CartItem[]>();
    for (const item of cart) {
      groups.set(item.supplierName, [
        ...(groups.get(item.supplierName) ?? []),
        item,
      ]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [cart]);
  const totalUnits = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );
  const totalSuggestedUnits = useMemo(
    () =>
      attentionRows.reduce(
        (total, row) => total + Math.max(1, Math.ceil(row.suggestedQuantity)),
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
  const inProgressCount = useMemo(
    () =>
      [...activeOrderBySku.values()].filter(
        (order) => order.status === "ordered",
      ).length,
    [activeOrderBySku],
  );
  const orderCounts = useMemo(() => {
    const counts = { ...initialPurchaseOrderCounts };
    const canonicalById = new Map(
      canonicalPurchaseOrders.map((order) => [order.id, order.status]),
    );
    for (const [orderId, nextStatus] of Object.entries(orderStatusOverrides)) {
      const previousStatus = canonicalById.get(orderId);
      if (!previousStatus || previousStatus === nextStatus) continue;
      counts[previousStatus] = Math.max(0, counts[previousStatus] - 1);
      counts[nextStatus] += 1;
    }
    return counts;
  }, [canonicalPurchaseOrders, initialPurchaseOrderCounts, orderStatusOverrides]);
  const totalOrderCount = Object.values(orderCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const filteredOrders = useMemo(
    () =>
      orderFilter === "all"
        ? purchaseOrders
        : purchaseOrders.filter((order) => order.status === orderFilter),
    [orderFilter, purchaseOrders],
  );
  const hasActiveFilters =
    query.trim().length > 0 ||
    supplierFilter !== "all" ||
    priorityFilter !== "all";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(
        reconcileStoredCart(
          readStoredCart(cartStorageKey),
          rowBySku,
          openOrderSkus,
        ),
      );
      window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      setCartLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cartStorageKey, openOrderSkus, rowBySku]);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {
      // The workspace remains usable when browser storage is unavailable.
    }
  }, [cart, cartLoaded, cartStorageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setOrderStatusOverrides({}), 0);
    return () => window.clearTimeout(timer);
  }, [initialPurchaseOrders]);

  const selectedSupplierFor = useCallback(
    (row: ReorderAlertRow) => {
      const choices = [row.primarySupplier, row.secondarySupplier].filter(
        (value): value is string => Boolean(value),
      );
      const selected = suggestionSuppliers[row.sku];
      if (selected && choices.includes(selected)) return selected;
      if (supplierFilter !== "all" && choices.includes(supplierFilter)) {
        return supplierFilter;
      }
      return choices[0] ?? "Sin proveedor asignado";
    },
    [suggestionSuppliers, supplierFilter],
  );

  const updateSuggestionSupplier = useCallback(
    (sku: string, supplier: string) => {
      setSuggestionSuppliers((stored) => ({ ...stored, [sku]: supplier }));
    },
    [],
  );

  const addToCart = useCallback(
    (row: ReorderAlertRow, supplierName: string) => {
      if (activeOrderBySku.has(row.sku)) {
        toast.info("Este producto ya tiene un pedido pendiente.", {
          description:
            "Revisa su estado en Seguimiento antes de volver a solicitarlo.",
        });
        return;
      }
      if (supplierName === "Sin proveedor asignado") {
        toast.error("Este producto todavía no tiene un proveedor asignado.");
        return;
      }
      let added = false;
      setCart((storedCart) => {
        if (storedCart.some((item) => item.sku === row.sku)) return storedCart;
        added = true;
        return [
          ...storedCart,
          {
            sku: row.sku,
            productName: row.productName,
            available: row.available,
            minimumStock: row.minimumStock,
            maximumStock: row.maximumStock,
            primarySupplier: row.primarySupplier ?? "Sin proveedor asignado",
            secondarySupplier: row.secondarySupplier,
            supplierName,
            quantity: Math.min(
              MAX_ORDER_QUANTITY,
              Math.max(1, Math.ceil(row.suggestedQuantity)),
            ),
          },
        ];
      });
      if (added) {
        toast.success("Producto agregado al pedido", {
          description: `${row.sku} · ${supplierName}`,
        });
      }
    },
    [activeOrderBySku],
  );

  const showOrderTracking = useCallback(() => {
    setTab("history");
    window.setTimeout(() => {
      document
        .getElementById("purchase-order-tracking")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const updateCartItem = useCallback(
    (sku: string, patch: Partial<CartItem>) => {
      setCart((storedCart) =>
        storedCart.map((item) =>
          item.sku === sku ? { ...item, ...patch } : item,
        ),
      );
    },
    [],
  );

  const removeCartItem = useCallback((sku: string) => {
    setCart((storedCart) => storedCart.filter((item) => item.sku !== sku));
  }, []);

  const showCart = useCallback(() => {
    if (window.matchMedia("(min-width: 1440px)").matches) {
      document
        .getElementById("purchase-cart")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setCartOpen(true);
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSupplierFilter("all");
    setPriorityFilter("all");
  }, []);

  async function createOrders() {
    if (!cart.length) return;
    if (
      cart.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > MAX_ORDER_QUANTITY,
      )
    ) {
      toast.error("Revisa las cantidades antes de guardar.", {
        description: `Cada cantidad debe estar entre 1 y ${number.format(MAX_ORDER_QUANTITY)}.`,
      });
      return;
    }
    if (cart.some((item) => item.supplierName === "Sin proveedor asignado")) {
      toast.error("Todos los productos necesitan un proveedor.");
      return;
    }
    if (cartGroups.length > MAX_SUPPLIER_ORDERS) {
      toast.error("Hay demasiados proveedores en una sola preparación.", {
        description: `Guarda máximo ${MAX_SUPPLIER_ORDERS} borradores a la vez.`,
      });
      return;
    }

    const exportGroups = cartGroups.map(([supplierName, items]) => ({
      supplierName,
      items: items.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
      })),
    }));

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
        if (!response.ok) {
          throw new Error(body.message ?? "No pudimos guardar los borradores.");
        }
      }
      let filesDownloaded = false;
      try {
        const { downloadPurchaseOrderFiles } = await import(
          "@/lib/orders/export-purchase-orders"
        );
        await downloadPurchaseOrderFiles(exportGroups);
        filesDownloaded = true;
      } catch (exportError) {
        console.error("No pudimos exportar los pedidos guardados", exportError);
        toast.warning("Los borradores se guardaron, pero faltó la descarga", {
          description:
            "No se duplicó ningún pedido. Puedes reintentar solamente la descarga.",
          action: {
            label: "Reintentar",
            onClick: () => {
              void import("@/lib/orders/export-purchase-orders")
                .then(({ downloadPurchaseOrderFiles }) =>
                  downloadPurchaseOrderFiles(exportGroups),
                )
                .then(() => toast.success("Archivos descargados correctamente"))
                .catch(() =>
                  toast.error("No pudimos descargar los archivos", {
                    description: "Intenta nuevamente en unos momentos.",
                  }),
                );
            },
          },
        });
      }

      if (filesDownloaded) {
        toast.success(
          `${cartGroups.length} ${cartGroups.length === 1 ? "borrador guardado" : "borradores guardados"}`,
          {
            description:
              cartGroups.length === 1
                ? "Se descargó el Excel del proveedor."
                : `Se descargó un ZIP con ${cartGroups.length} Excel, uno por proveedor.`,
          },
        );
      }
      setCart([]);
      setCartOpen(false);
      setOlderPurchaseOrders([]);
      setPurchaseOrdersPageOverride(null);
      setTab("history");
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      router.refresh();
    } catch (error) {
      toast.error("No pudimos guardar los borradores", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(
    order: PurchaseOrder,
    status: PurchaseOrderStatus,
  ) {
    setUpdatingOrderId(order.id);
    try {
      if (!isDemo) {
        const response = await fetch("/api/purchase-orders", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: order.id, status }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) {
          throw new Error(body.message ?? "No pudimos actualizar el pedido.");
        }
      }
      if (status === "received") {
        toast.success("Pedido marcado como recibido", {
          description:
            "Sus referencias ya pueden volver a agregarse a una compra.",
        });
      } else if (status === "ordered") {
        toast.success("Pedido en curso", {
          description:
            "Sus referencias quedarán bloqueadas hasta confirmar que llegaron.",
        });
      } else {
        toast.success("Pedido cancelado", {
          description:
            "Sus referencias volvieron a quedar disponibles para comprar.",
        });
      }
      setOrderStatusOverrides((overrides) => ({
        ...overrides,
        [order.id]: status,
      }));
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      router.refresh();
    } catch (error) {
      toast.error("No pudimos actualizar el pedido", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function loadOlderOrders() {
    if (loadingOlderOrders || !purchaseOrdersPage.hasMore) return;
    setLoadingOlderOrders(true);
    try {
      const response = await fetch(
        `/api/purchase-orders?offset=${purchaseOrdersPage.nextOffset}&before=${encodeURIComponent(purchaseOrdersPage.snapshotBefore)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        orders?: PurchaseOrder[];
        page?: PurchaseOrdersPageInfo;
        message?: string;
      };
      if (!response.ok || !body.orders || !body.page) {
        throw new Error(
          body.message ?? "No pudimos cargar los pedidos anteriores.",
        );
      }
      setOlderPurchaseOrders((currentOrders) =>
        mergePurchaseOrders(currentOrders, body.orders!),
      );
      setPurchaseOrdersPageOverride(body.page);
    } catch (error) {
      toast.error("No pudimos cargar más pedidos", {
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setLoadingOlderOrders(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Gestión de compras"
        title="Pedidos"
        description="Decide qué reponer, prepara cada compra por proveedor y acompaña el pedido hasta recibirlo."
        icon={ClipboardList}
        action={
          canEdit ? (
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Agregar otro producto
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:w-fit">
            <TabsTrigger value="prepare">
              <ShoppingCart className="hidden sm:block" aria-hidden="true" />
              Preparar compra
              {cart.length ? <Badge variant="secondary">{cart.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="history">
              <ClipboardCheck className="hidden sm:block" aria-hidden="true" />
              Seguimiento
              {purchaseOrders.length ? (
                <Badge variant="secondary">{purchaseOrders.length}</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {tab === "prepare" ? (
            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Resumen de preparación"
            >
              <Badge variant="outline">
                {attentionRows.length} por reponer
              </Badge>
              <Badge variant="outline">
                {number.format(totalSuggestedUnits)} unidades sugeridas
              </Badge>
              <Badge variant="outline">
                {inProgressCount} {inProgressCount === 1 ? "pedido en curso" : "pedidos en curso"}
              </Badge>
            </div>
          ) : null}
        </div>

        <TabsContent value="prepare" className="mt-0">
          {!canEdit ? (
            <Alert className="mb-4">
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Vista de consulta</AlertTitle>
              <AlertDescription>
                Un administrador o cargador puede preparar y guardar pedidos.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid items-start gap-4 min-[1440px]:grid-cols-[minmax(0,1fr)_22rem]">
            <Card className="overflow-hidden">
              <CardHeader className="gap-5 border-b bg-muted/10">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="font-display text-2xl uppercase">
                      Lista de compra
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Empieza por los más urgentes y elige el proveedor antes de
                      agregarlos.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {filteredSuggestions.length}{" "}
                    {filteredSuggestions.length === 1 ? "resultado" : "resultados"}
                  </Badge>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Qué atender primero
                  </p>
                  <PriorityFilterBar
                    value={priorityFilter}
                    counts={priorityCounts}
                    total={attentionRows.length}
                    onChange={setPriorityFilter}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar producto o referencia…"
                      className="pl-10"
                      aria-label="Buscar en la lista de compra"
                    />
                  </div>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger aria-label="Filtrar por proveedor">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier} value={supplier}>
                            {supplier}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    <FilterX data-icon="inline-start" aria-hidden="true" />
                    Limpiar
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-3 pb-28 sm:p-4 sm:pb-28 min-[1440px]:pb-4">
                {filteredSuggestions.length > 0 ? (
                  <div className="data-list flex flex-col gap-3" role="list">
                    {filteredSuggestions.map((row) => (
                      <div key={row.id} role="listitem">
                        <PurchaseProductRow
                          row={row}
                          selectedSupplier={selectedSupplierFor(row)}
                          inCart={cartSkus.has(row.sku)}
                          activeOrder={activeOrderBySku.get(row.sku)}
                          canEdit={canEdit}
                          onSupplierChange={updateSuggestionSupplier}
                          onAdd={addToCart}
                          onReviewCart={showCart}
                          onOpenTracking={showOrderTracking}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <CheckCircle2 aria-hidden="true" />
                    <AlertTitle>No hay productos para estos filtros</AlertTitle>
                    <AlertDescription>
                      Limpia los filtros o agrega otra referencia manualmente.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <aside
              className="hidden min-[1440px]:sticky min-[1440px]:top-24 min-[1440px]:block"
              aria-label="Pedido en preparación"
            >
              <PurchaseCartPanel
                cartGroups={cartGroups}
                cartLoaded={cartLoaded}
                cartLength={cart.length}
                totalUnits={totalUnits}
                canEdit={canEdit}
                saving={saving}
                onUpdate={updateCartItem}
                onRemove={removeCartItem}
                onCreate={createOrders}
              />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card id="purchase-order-tracking" className="scroll-mt-24">
            <CardHeader className="gap-4 border-b bg-muted/10">
              <div>
                <CardTitle className="font-display text-2xl uppercase">
                  Seguimiento de pedidos
                </CardTitle>
                <CardDescription className="mt-1">
                  Consulta qué está en borrador, qué ya se solicitó y qué fue
                  recibido. Los pedidos anteriores se cargan por bloques para
                  mantener la vista rápida.
                </CardDescription>
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                value={orderFilter}
                onValueChange={(value) =>
                  setOrderFilter((value || "all") as OrderFilter)
                }
                className="flex-wrap justify-start"
                aria-label="Filtrar pedidos por estado"
              >
                {[
                  [
                    "all",
                    "Todos",
                    totalOrderCount,
                  ],
                  ["draft", "Borradores", orderCounts.draft],
                  ["ordered", "En curso", orderCounts.ordered],
                  ["received", "Recibidos", orderCounts.received],
                  ["cancelled", "Cancelados", orderCounts.cancelled],
                ].map(([value, label, count]) => (
                  <ToggleGroupItem
                    key={String(value)}
                    value={String(value)}
                    className="min-h-11 rounded-xl px-3"
                  >
                    {String(label)}
                    <Badge variant="secondary">{Number(count)}</Badge>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                Mostrando {purchaseOrders.length} de {totalOrderCount} pedidos.
              </p>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {filteredOrders.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {filteredOrders.map((order) => (
                    <PurchaseOrderCard
                      key={order.id}
                      order={order}
                      canEdit={canEdit}
                      updating={updatingOrderId === order.id}
                      onUpdateStatus={updateOrderStatus}
                      onRequestReceived={setOrderToReceive}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center p-6 text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      <ClipboardList aria-hidden="true" />
                    </span>
                    <p className="mt-4 font-semibold">
                      {purchaseOrders.length
                        ? "No hay pedidos con este estado"
                        : "Aún no hay pedidos guardados"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {purchaseOrders.length
                        ? purchaseOrdersPage.hasMore
                          ? "Puede haber resultados en pedidos anteriores. Cárgalos para continuar."
                          : "Elige otro estado para continuar."
                        : "Prepara una compra y guarda el primer borrador por proveedor."}
                    </p>
                    {!purchaseOrders.length ? (
                      <Button className="mt-5" onClick={() => setTab("prepare")}>
                        <ShoppingCart
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Preparar compra
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
              {purchaseOrdersPage.hasMore ? (
                <div className="mt-4 flex justify-center border-t pt-4">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={loadOlderOrders}
                    disabled={loadingOlderOrders}
                  >
                    {loadingOlderOrders ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown data-icon="inline-start" aria-hidden="true" />
                    )}
                    {loadingOlderOrders
                      ? "Cargando pedidos…"
                      : "Cargar pedidos anteriores"}
                  </Button>
                </div>
              ) : purchaseOrders.length > 0 ? (
                <p className="mt-4 border-t pt-4 text-center text-xs text-muted-foreground">
                  Llegaste al final del historial disponible.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {tab === "prepare" && cart.length > 0 ? (
        <Button
          variant="secondary"
          className="fixed inset-x-4 bottom-4 z-40 h-auto min-h-16 justify-between rounded-2xl border border-primary/30 px-4 py-3 shadow-xl sm:left-auto sm:min-w-96 min-[1440px]:hidden"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex items-center gap-3 text-left">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingCart aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold">Revisar pedido</span>
              <span className="block text-xs font-normal text-secondary-foreground/70">
                {cart.length} {cart.length === 1 ? "producto" : "productos"} ·{" "}
                {number.format(totalUnits)} unidades
              </span>
            </span>
          </span>
          <Badge>{cartGroups.length}</Badge>
        </Button>
      ) : null}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg min-[1440px]:hidden"
        >
          <SheetHeader className="racing-stripe shrink-0 border-b border-secondary bg-secondary p-5 pr-16 text-left text-secondary-foreground sm:p-6 sm:pr-16">
            <SheetTitle className="font-display text-xl uppercase text-secondary-foreground">
              Pedido en preparación
            </SheetTitle>
            <SheetDescription className="text-secondary-foreground/70">
              Revisa proveedores y cantidades antes de guardar.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <CartItemsList
              cartGroups={cartGroups}
              cartLoaded={cartLoaded}
              idPrefix="sheet-cart"
              onUpdate={updateCartItem}
              onRemove={removeCartItem}
            />
          </div>
          <div className="shrink-0 border-t bg-background p-4 sm:p-5">
            <CartCheckout
              cartLength={cart.length}
              groupCount={cartGroups.length}
              totalUnits={totalUnits}
              canEdit={canEdit}
              saving={saving}
              onCreate={createOrders}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={manualOpen}
        onOpenChange={(open) => {
          setManualOpen(open);
          if (!open) setManualQuery("");
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar otro producto</DialogTitle>
            <DialogDescription>
              Busca cualquier producto de recompra, aunque todavía no haya
              llegado al mínimo.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={manualQuery}
              onChange={(event) => setManualQuery(event.target.value)}
              placeholder="Nombre o referencia…"
              className="pl-10"
              aria-label="Buscar producto para agregar al pedido"
            />
          </div>
          <div className="flex flex-col gap-2">
            {manualOptions.map((row) => {
              const supplier = selectedSupplierFor(row);
              const hasSupplier = supplier !== "Sin proveedor asignado";
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">
                      {row.productName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ref. {row.sku} · Disponible {number.format(row.available)} ·{" "}
                      {hasSupplier ? supplier : "Sin proveedor"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!canEdit || !hasSupplier}
                    onClick={() => {
                      addToCart(row, supplier);
                      setManualOpen(false);
                      setManualQuery("");
                    }}
                  >
                    <Plus data-icon="inline-start" aria-hidden="true" />
                    Agregar
                  </Button>
                </div>
              );
            })}
          </div>
          {manualOptions.length === 0 ? (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>No encontramos productos disponibles</AlertTitle>
              <AlertDescription>
                Prueba con otro nombre o referencia.
              </AlertDescription>
            </Alert>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(orderToReceive)}
        onOpenChange={(open) => {
          if (!open) setOrderToReceive(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Confirmas que este pedido llegó?</DialogTitle>
            <DialogDescription>
              Al confirmar, sus referencias volverán a quedar disponibles para
              nuevos pedidos. Hazlo únicamente después de verificar físicamente
              la mercancía.
            </DialogDescription>
          </DialogHeader>
          {orderToReceive ? (
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-semibold">{orderToReceive.supplierName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {orderToReceive.orderNumber} · {orderToReceive.items.length}{" "}
                {orderToReceive.items.length === 1 ? "producto" : "productos"}
              </p>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setOrderToReceive(null)}
            >
              Seguir esperando
            </Button>
            <Button
              className="min-h-11"
              onClick={() => {
                if (!orderToReceive) return;
                const receivedOrder = orderToReceive;
                setOrderToReceive(null);
                void updateOrderStatus(receivedOrder, "received");
              }}
            >
              <PackageCheck data-icon="inline-start" aria-hidden="true" />
              Sí, ya llegó
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
