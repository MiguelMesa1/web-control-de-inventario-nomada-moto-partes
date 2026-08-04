"use client";

import {
  Boxes,
  ChevronDown,
  CircleAlert,
  Copy,
  Layers3,
  LoaderCircle,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
} from "lucide-react";
import dynamic from "next/dynamic";
import { type CSSProperties, useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getPlasticKitColorStyle } from "@/lib/inventory/plastic-kit-colors";
import {
  calculatePlasticKitAvailability,
  comparePlasticKitsForDisplay,
} from "@/lib/inventory/plastic-kits";
import { buildPlasticKitSavePayload } from "@/lib/inventory/plastic-kit-request";
import {
  normalizeInventoryText,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import type { PlasticKitAvailability, PlasticKitDefinition } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const copySuffixPattern = /\s+\(copia(?: \d+)?\)$/i;
const PRIMARY_WAREHOUSE = "Principal";

function kitLine(kit: PlasticKitDefinition) {
  return kit.model?.trim() || kit.brand.trim();
}

function duplicateKitName(name: string, existingNames: string[]) {
  const baseName = name.replace(copySuffixPattern, "").trim() || "Kit";
  const normalizedNames = new Set(
    existingNames.map((value) => value.trim().toLocaleLowerCase("es")),
  );

  for (let copyNumber = 1; copyNumber <= existingNames.length + 1; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " (copia)" : ` (copia ${copyNumber})`;
    const candidate = `${baseName.slice(0, 120 - suffix.length).trim()}${suffix}`;
    if (!normalizedNames.has(candidate.toLocaleLowerCase("es"))) return candidate;
  }

  return `${baseName.slice(0, 110).trim()} (copia)`;
}

const PlasticKitDialog = dynamic(
  () => import("@/components/plastic-kit-dialog").then((module) => module.PlasticKitDialog),
  { ssr: false },
);

function StockBadge({ kit, threshold }: { kit: PlasticKitAvailability; threshold: number }) {
  if (kit.available <= 0) {
    return <Badge variant="destructive"><PackageX /> Agotado</Badge>;
  }
  if (kit.available <= threshold) {
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

export function PlasticKitsOverview({ initialKits }: { initialKits: PlasticKitDefinition[] }) {
  const { current, lowStockThreshold, isDemo } = useInventoryData();
  const profile = useProfile();
  const isAdmin = profile.role === "admin";
  const [definitions, setDefinitions] = useState(initialKits);
  const [query, setQuery] = useState("");
  const [line, setLine] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSession, setDialogSession] = useState(0);
  const [editing, setEditing] = useState<PlasticKitDefinition | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlasticKitDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const kits = useMemo(
    () =>
      calculatePlasticKitAvailability(
        definitions.filter((definition) => definition.active),
        current,
      ).sort(comparePlasticKitsForDisplay),
    [current, definitions],
  );
  const lineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const kit of kits) {
      const normalizedLine = normalizeInventoryText(kitLine(kit));
      counts.set(normalizedLine, (counts.get(normalizedLine) ?? 0) + 1);
    }
    return counts;
  }, [kits]);
  const visibleKits = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase("es");
    return kits.filter((kit) => {
      const matchesLine =
        line === "all" ||
        normalizeInventoryText(kitLine(kit)) === normalizeInventoryText(line);
      const haystack = [kit.name, kit.brand, kit.model, kit.color, ...kit.parts.flatMap((part) => [part.sku, part.productName])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      return matchesLine && (!normalized || haystack.includes(normalized));
    });
  }, [deferredQuery, kits, line]);

  const totalStock = kits.reduce((total, kit) => total + kit.available, 0);
  const exhausted = kits.filter((kit) => kit.available <= 0).length;
  const low = kits.filter((kit) => kit.available > 0 && kit.available <= lowStockThreshold).length;

  function openCreate() {
    setEditing(null);
    setDialogSession((value) => value + 1);
    setDialogOpen(true);
  }

  function openEdit(kit: PlasticKitDefinition) {
    setEditing(kit);
    setDialogSession((value) => value + 1);
    setDialogOpen(true);
  }

  function saveLocally(saved: PlasticKitDefinition) {
    setDefinitions((value) => {
      const existingIndex = value.findIndex((kit) => kit.id === saved.id);
      if (existingIndex < 0) return [...value, saved];
      return value.map((kit) => (kit.id === saved.id ? saved : kit));
    });
  }

  async function duplicateKit(kit: PlasticKitDefinition) {
    setDuplicatingId(kit.id);
    try {
      const duplicate: PlasticKitDefinition = {
        id: crypto.randomUUID(),
        name: duplicateKitName(kit.name, definitions.map((item) => item.name)),
        brand: kitLine(kit),
        color: kit.color,
        hasHeadlight: kit.hasHeadlight,
        model: kitLine(kit),
        warehouse: PRIMARY_WAREHOUSE,
        active: true,
        parts: kit.parts.map((part, position) => ({
          sku: part.sku,
          productName: part.productName,
          quantityRequired: part.quantityRequired,
          position,
        })),
      };

      if (!isDemo) {
        const response = await fetch("/api/plastic-kits", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildPlasticKitSavePayload(duplicate)),
        });
        const body = (await response.json()) as { id?: string; message?: string };
        if (!response.ok) throw new Error(body.message || "No pudimos duplicar el kit.");
        if (body.id) duplicate.id = body.id;
      }

      saveLocally(duplicate);
      toast.success("Kit duplicado", { description: duplicate.name });
    } catch (error) {
      toast.error("No pudimos duplicar el kit", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setDuplicatingId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!isDemo) {
        const response = await fetch(`/api/plastic-kits?id=${encodeURIComponent(deleteTarget.id)}`, {
          method: "DELETE",
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message || "No pudimos eliminar el kit.");
      }
      setDefinitions((value) => value.filter((kit) => kit.id !== deleteTarget.id));
      toast.success("Kit eliminado", { description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (error) {
      toast.error("No pudimos eliminar el kit", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inventario compuesto"
        title="Kit Plástico"
        description="Crea cada kit con sus piezas individuales. La disponibilidad se calcula automáticamente usando la pieza que alcanza para menos kits."
        icon={Boxes}
        action={isAdmin ? <Button onClick={openCreate}><Plus /> Crear kit</Button> : undefined}
      />

      <section aria-label="Resumen de kits plásticos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Kits creados", value: number.format(kits.length), icon: Boxes },
          { label: "Unidades armables", value: number.format(totalStock), icon: Warehouse },
          { label: "Kits agotados", value: number.format(exhausted), icon: PackageX },
          { label: "Con stock bajo", value: number.format(low), icon: CircleAlert },
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
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="font-display text-2xl uppercase">Kits configurados</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                El resultado cambia automáticamente después de cada nueva carga de inventario.
              </p>
            </div>
            <div className="w-full lg:w-80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar kit, pieza o SKU…"
                  className="h-11 pl-10"
                  aria-label="Buscar kits"
                />
              </div>
            </div>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar kits por línea principal"
          >
            <Button
              type="button"
              size="sm"
              variant={line === "all" ? "default" : "outline"}
              className="min-h-11 rounded-full px-4"
              aria-pressed={line === "all"}
              onClick={() => setLine("all")}
            >
              Todas <span className="text-xs opacity-75">{kits.length}</span>
            </Button>
            {PRIORITY_PRODUCT_LINES.map((item) => {
              const selected = line === item;
              const count = lineCounts.get(normalizeInventoryText(item)) ?? 0;
              return (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="min-h-11 rounded-full px-4"
                  aria-pressed={selected}
                  onClick={() => setLine(item)}
                >
                  {item} <span className="text-xs opacity-75">{count}</span>
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {visibleKits.length ? (
            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleKits.map((kit) => {
                const colorStyle = getPlasticKitColorStyle(kit.color);
                return (
                  <article
                    key={kit.id}
                    className="plastic-kit-color-card overflow-hidden rounded-2xl border-2 [content-visibility:auto] [contain-intrinsic-size:14rem]"
                    data-kit-emphasis={colorStyle.emphasis}
                    style={
                      {
                        "--kit-border": colorStyle.border,
                        "--kit-border-dark": colorStyle.borderDark,
                        "--kit-surface": colorStyle.surface,
                        "--kit-surface-dark": colorStyle.surfaceDark,
                      } as CSSProperties
                    }
                  >
                    <div className="border-b px-4 pb-4 pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="bg-background/55">{kitLine(kit)}</Badge>
                          <Badge variant="outline" className="gap-1.5 bg-background/45">
                            <span className="plastic-kit-color-dot" aria-hidden="true" />
                            {kit.color}
                          </Badge>
                          <Badge variant="outline" className="bg-background/35">
                            {kit.hasHeadlight ? "Con farola" : "Sin farola"}
                          </Badge>
                        </div>
                        <div className="min-w-[5.75rem] shrink-0 rounded-xl border bg-background/45 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
                          <p className="font-display text-3xl font-bold tabular-nums">{number.format(kit.available)}</p>
                          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">kits armables</p>
                        </div>
                      </div>
                      <h3 className="mt-3 break-words font-display text-lg font-bold uppercase leading-tight" title={kit.name}>{kit.name}</h3>
                      <div className="mt-2"><StockBadge kit={kit} threshold={lowStockThreshold} /></div>
                    </div>

                    <div className="flex items-center justify-between gap-3 bg-background/20 px-3 py-2">
                      <p className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-4" /> {kit.parts.length} piezas</p>
                      {isAdmin && (
                        <div className="flex gap-1 rounded-xl border bg-background/35 p-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11"
                            disabled={duplicatingId === kit.id}
                            onClick={() => void duplicateKit(kit)}
                            aria-label={`Duplicar ${kit.name}`}
                            title="Duplicar kit"
                          >
                            {duplicatingId === kit.id ? (
                              <LoaderCircle className="animate-spin" />
                            ) : (
                              <Copy />
                            )}
                          </Button>
                          <Button className="size-11" variant="ghost" size="icon" onClick={() => openEdit(kit)} aria-label={`Editar ${kit.name}`}><Pencil /></Button>
                          <Button className="size-11" variant="ghost" size="icon" onClick={() => setDeleteTarget(kit)} aria-label={`Eliminar ${kit.name}`}><Trash2 /></Button>
                        </div>
                      )}
                    </div>

                    <details className="group border-t">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 bg-background/15 px-4 py-2 text-sm font-semibold transition-colors hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        Ver detalle de las piezas
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                      </summary>
                      <div className="grid gap-2 border-t bg-muted/15 p-3">
                        {kit.parts.map((part) => (
                          <div
                            key={part.sku}
                            className={`grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${part.isLimiting ? "border-primary/50 bg-primary/10" : "bg-background/60"}`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold">{part.sku}</span>
                                {part.isLimiting && <Badge variant="outline">Pieza limitante</Badge>}
                                {!part.hasInventoryRecord && <Badge variant="destructive">No llegó en la carga</Badge>}
                              </div>
                              <p className="mt-1 truncate text-sm" title={part.productName}>{part.productName}</p>
                            </div>
                            <p className="text-sm sm:text-right">
                              <span className="font-bold tabular-nums">{number.format(part.available)}</span> disp.
                              <span className="block text-xs text-muted-foreground">{part.quantityRequired} por kit · {part.kitCapacity} kits</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed p-8 text-center">
              <div className="max-w-md">
                <Boxes className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
                <p className="mt-4 font-semibold">{kits.length ? "No hay kits para este filtro" : "Crea tu primer kit plástico"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {kits.length
                    ? "Prueba otra búsqueda o selecciona todas las líneas."
                    : "Ya no necesitas que el Excel incluya el producto combo: selecciona aquí las piezas individuales que lo componen."}
                </p>
                {!kits.length && isAdmin && <Button className="mt-5" onClick={openCreate}><Plus /> Crear primer kit</Button>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {dialogOpen ? (
        <PlasticKitDialog
          key={`${editing?.id ?? "new"}-${dialogSession}`}
          open
          onOpenChange={setDialogOpen}
          kit={editing}
          inventory={current}
          isDemo={isDemo}
          onSaved={saveLocally}
        />
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar kit plástico</DialogTitle>
            <DialogDescription>
              Se eliminará la configuración de “{deleteTarget?.name}”. Las piezas individuales y su inventario no se modificarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              {deleting ? "Eliminando…" : "Eliminar kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
