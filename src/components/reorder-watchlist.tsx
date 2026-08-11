"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
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
import {
  isPriorityProductLine,
  normalizeInventoryText,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import { buildReorderAlertRows } from "@/lib/inventory/reorder";
import type {
  ProductHistorySubject,
  ReorderAlertRow,
  ReorderWatchItem,
} from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

type FormState = {
  sourceId: string;
  sku: string;
  productName: string;
  reorderPoint: string;
  notes: string;
};

const emptyForm: FormState = {
  sourceId: "",
  sku: "",
  productName: "",
  reorderPoint: "10",
  notes: "",
};

function statusBadge(row: ReorderAlertRow) {
  if (row.status === "missing") {
    return <Badge variant="outline">Sin registro</Badge>;
  }
  if (row.status === "exhausted") {
    return <Badge variant="destructive">Agotado</Badge>;
  }
  if (row.status === "reorder") {
    return <Badge className="bg-primary text-primary-foreground">Por solicitar</Badge>;
  }
  return <Badge variant="secondary">Nivel estable</Badge>;
}

export function ReorderWatchlist() {
  const router = useRouter();
  const { current, reorderWatchlist, reorderLineSettings, isDemo } = useInventoryData();
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("attention");
  const [line, setLine] = useState("priority");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReorderWatchItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [lineRule, setLineRule] = useState("");
  const [linePoint, setLinePoint] = useState("10");
  const [savingLine, setSavingLine] = useState(false);
  const [historyItem, setHistoryItem] =
    useState<ProductHistorySubject | null>(null);
  const deferredQuery = useDeferredValue(query);
  const productLines = useMemo(
    () => [...new Set(current.map((item) => item.productLine))].sort((a, b) => a.localeCompare(b, "es")),
    [current],
  );
  const historySubjects = useMemo(() => {
    const subjects = new Map<string, ProductHistorySubject>();

    for (const item of current) {
      const existing = subjects.get(item.sku);
      const isPrincipal =
        normalizeInventoryText(item.warehouse) === "principal";
      const existingIsPrincipal =
        existing && normalizeInventoryText(existing.warehouse) === "principal";

      if (!existing || (isPrincipal && !existingIsPrincipal)) {
        subjects.set(item.sku, item);
      }
    }

    return subjects;
  }, [current]);

  const rows = useMemo(
    () =>
      buildReorderAlertRows(
        reorderWatchlist.filter((item) => item.active),
        current,
        reorderLineSettings,
      ).sort((a, b) => {
        return (
          (a.hasInventoryRecord ? 0 : 1) -
            (b.hasInventoryRecord ? 0 : 1) ||
          a.available - b.available ||
          a.productName.localeCompare(b.productName, "es")
        );
      }),
    [current, reorderLineSettings, reorderWatchlist],
  );

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalized ||
        row.sku.toLowerCase().includes(normalized) ||
        row.productName.toLowerCase().includes(normalized);
      const matchesStatus =
        status === "all" ||
        (status === "attention" && row.status !== "healthy") ||
        row.status === status;
      const matchesLine =
        line === "all" ||
        (line === "priority" &&
          Boolean(row.productLine && isPriorityProductLine(row.productLine))) ||
        normalizeInventoryText(row.productLine ?? "") ===
          normalizeInventoryText(line);
      return matchesQuery && matchesStatus && matchesLine;
    });
  }, [deferredQuery, line, rows, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const firstVisible = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(safePage * pageSize, filtered.length);
  const pageRows = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const metrics = {
    monitored: rows.length,
    attention: rows.filter((row) => row.status !== "healthy").length,
    exhausted: rows.filter((row) => row.status === "exhausted").length,
    missing: rows.filter((row) => row.status === "missing").length,
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
      reorderPoint: item.reorderPoint.toString(),
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
    if (!form.sku.trim() || !form.productName.trim()) {
      toast.error("Completa la referencia y el nombre del producto.");
      return;
    }
    setSaving(true);
    try {
      if (!isDemo) {
        const response = await fetch("/api/reorder-watchlist", {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            editing
              ? {
                  id: editing.id,
                  reorderPoint: Number(form.reorderPoint),
                  notes: form.notes,
                  active: true,
                }
              : {
                  sourceId: form.sourceId ? Number(form.sourceId) : undefined,
                  sku: form.sku,
                  productName: form.productName,
                  reorderPoint: Number(form.reorderPoint),
                  notes: form.notes,
                },
          ),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success(editing ? "Punto de reorden actualizado" : "Producto agregado", {
        description: `${form.sku} se vigilará en ${form.reorderPoint} unidades.`,
      });
      setDialogOpen(false);
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
    if (!window.confirm(`¿Retirar ${item.sku} del Punto de Reorden?`)) return;
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
      toast.success("Producto retirado de la vigilancia");
      router.refresh();
    } catch (error) {
      toast.error("No pudimos retirar el producto", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function saveLineRule() {
    if (!lineRule) return;
    setSavingLine(true);
    try {
      if (!isDemo) {
        const response = await fetch("/api/reorder-line-settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productLine: lineRule, reorderPoint: Number(linePoint) }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success("Punto por línea guardado", { description: `${lineRule}: ${linePoint} unidades.` });
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      router.refresh();
    } catch (error) {
      toast.error("No pudimos guardar la regla", { description: error instanceof Error ? error.message : "Intenta nuevamente." });
    } finally {
      setSavingLine(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Alertas de compra"
        title="Punto de Reorden"
        description="Productos ordenados de menor a mayor disponibilidad."
        icon={ShoppingCart}
      />

      {metrics.attention > 0 && (
        <Alert className="border-primary/60 bg-primary/10">
          <AlertTriangle />
          <AlertTitle>{metrics.attention} productos por revisar</AlertTitle>
          <AlertDescription>
            La alerta aparece al llegar a 10 unidades o al punto configurado.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl uppercase">Puntos por línea</CardTitle>
          <p className="text-sm text-muted-foreground">Esta regla reemplaza el punto individual de los productos vigilados de la línea seleccionada.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="reorder-line">Línea</Label>
              <Select value={lineRule} onValueChange={(value) => {
                setLineRule(value);
                const existing = reorderLineSettings.find((setting) => setting.productLine === value);
                setLinePoint(String(existing?.reorderPoint ?? 10));
              }} disabled={!isAdmin}>
                <SelectTrigger id="reorder-line"><SelectValue placeholder="Selecciona una línea" /></SelectTrigger>
                <SelectContent>{productLines.map((productLine) => <SelectItem key={productLine} value={productLine}>{productLine}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-40"><Label htmlFor="reorder-line-point">Punto</Label><Input id="reorder-line-point" type="number" min={0} value={linePoint} disabled={!isAdmin} onChange={(event) => setLinePoint(event.target.value)} /></div>
            <Button onClick={saveLineRule} disabled={!isAdmin || !lineRule || savingLine}>{savingLine ? <LoaderCircle className="animate-spin" /> : null}Guardar línea</Button>
          </div>
          {reorderLineSettings.length > 0 && <p className="text-sm text-muted-foreground">Reglas activas: {reorderLineSettings.map((setting) => `${setting.productLine} (${number.format(setting.reorderPoint)})`).join(" · ")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="font-display text-2xl uppercase">
              Productos vigilados
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{metrics.monitored} vigilados</Badge>
              <Badge variant="destructive">{metrics.exhausted} agotados</Badge>
              {metrics.missing > 0 && (
                <Badge variant="outline">{metrics.missing} sin registro</Badge>
              )}
            </div>
          </div>
          {isAdmin && (
            <Button onClick={openAdd}>
              <PackagePlus /> Agregar producto
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_repeat(3,210px)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por SKU o producto…"
                className="pl-10"
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
                <SelectItem value="attention">Requieren atención</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="reorder">Por solicitar</SelectItem>
                <SelectItem value="exhausted">Agotados</SelectItem>
                <SelectItem value="missing">Sin registro</SelectItem>
                <SelectItem value="healthy">Nivel estable</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={line}
              onValueChange={(value) => {
                setLine(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filtrar por línea">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Líneas principales</SelectItem>
                {PRIORITY_PRODUCT_LINES.map((productLine) => (
                  <SelectItem key={productLine} value={productLine}>
                    {productLine}
                  </SelectItem>
                ))}
                <SelectItem value="all">Todas las líneas</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Productos por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Punto</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {historySubjects.has(row.sku) ? (
                        <button
                          type="button"
                          className="min-h-11 rounded-lg px-2 font-mono text-xs font-bold text-foreground underline decoration-primary/45 underline-offset-4 transition-colors hover:bg-primary/10 hover:decoration-primary"
                          onClick={() =>
                            setHistoryItem(historySubjects.get(row.sku) ?? null)
                          }
                          aria-label={`Ver historial de ${row.sku}, ${row.productName}`}
                        >
                          {row.sku}
                        </button>
                      ) : (
                        <span className="font-mono text-xs font-bold">
                          {row.sku}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm font-medium">
                      {row.productName}
                    </TableCell>
                    <TableCell>{row.productLine ?? "Sin línea"}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {row.hasInventoryRecord ? number.format(row.available) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {number.format(row.reorderPoint)}
                    </TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Editar ${row.sku}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(row)}
                          disabled={removingId === row.id}
                          aria-label={`Retirar ${row.sku}`}
                        >
                          {removingId === row.id ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {pageRows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {historySubjects.has(row.sku) ? (
                        <button
                          type="button"
                          className="min-h-11 rounded-lg px-2 font-mono text-xs font-bold text-foreground underline decoration-primary/45 underline-offset-4 transition-colors hover:bg-primary/10 hover:decoration-primary"
                          onClick={() =>
                            setHistoryItem(historySubjects.get(row.sku) ?? null)
                          }
                          aria-label={`Ver historial de ${row.sku}, ${row.productName}`}
                        >
                          {row.sku}
                        </button>
                      ) : (
                        <p className="font-mono text-xs font-bold">{row.sku}</p>
                      )}
                      <h3 className="mt-1 font-semibold">{row.productName}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.productLine ?? "Sin línea"}
                      </p>
                    </div>
                    {statusBadge(row)}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/45 p-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Disponible</p>
                      <p className="font-bold">
                        {row.hasInventoryRecord ? number.format(row.available) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Punto de reorden</p>
                      <p className="font-bold">{number.format(row.reorderPoint)}</p>
                    </div>
                  </div>
                  {historySubjects.has(row.sku) && (
                    <Button
                      variant="outline"
                      className="mt-3 min-h-11 w-full"
                      onClick={() =>
                        setHistoryItem(historySubjects.get(row.sku) ?? null)
                      }
                    >
                      <History data-icon="inline-start" />
                      Movimientos
                    </Button>
                  )}
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => openEdit(row)}>
                        <Pencil /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => remove(row)}
                        disabled={removingId === row.id}
                        aria-label={`Retirar ${row.sku}`}
                      >
                        {removingId === row.id ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-8 text-center">
              <div>
                <CheckCircle2 className="mx-auto size-9 text-primary" />
                <p className="mt-3 font-semibold">No hay productos para este filtro</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prueba otra búsqueda o consulta todos los estados.
                </p>
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                  aria-label="Página siguiente"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar punto de reorden" : "Agregar producto vigilado"}
            </DialogTitle>
            <DialogDescription>
              La alerta se activa cuando la disponibilidad total es igual o menor al
              punto definido.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="watch-sku">SKU / referencia</Label>
              <Input
                id="watch-sku"
                list="inventory-skus"
                value={form.sku}
                disabled={Boolean(editing)}
                onChange={(event) => changeSku(event.target.value)}
              />
              <datalist id="inventory-skus">
                {inventoryOptions.map(([sku, name]) => (
                  <option key={sku} value={sku}>{name}</option>
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="watch-source">ID de Effi</Label>
              <Input
                id="watch-source"
                type="number"
                value={form.sourceId}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm((value) => ({ ...value, sourceId: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="watch-name">Nombre del producto</Label>
              <Input
                id="watch-name"
                value={form.productName}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm((value) => ({ ...value, productName: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="watch-point">Punto de reorden</Label>
              <Input
                id="watch-point"
                type="number"
                min={0}
                value={form.reorderPoint}
                onChange={(event) =>
                  setForm((value) => ({ ...value, reorderPoint: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="watch-notes">Notas</Label>
              <Input
                id="watch-notes"
                value={form.notes}
                placeholder="Presentación, contacto o condición de compra"
                onChange={(event) =>
                  setForm((value) => ({ ...value, notes: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <PackagePlus />}
              {saving ? "Guardando…" : "Guardar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
