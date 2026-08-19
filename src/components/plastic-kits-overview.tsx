"use client";

import {
  Boxes,
  ChevronDown,
  CircleAlert,
  Copy,
  LayoutGrid,
  Layers3,
  LoaderCircle,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Trash2,
  Warehouse,
} from "lucide-react";
import dynamic from "next/dynamic";
import { type CSSProperties, useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { PlasticKitsMatrix } from "@/components/plastic-kits-matrix";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlasticKitColorStyle } from "@/lib/inventory/plastic-kit-colors";
import {
  normalizePlasticKitHeadlight,
  plasticKitLineSupportsHeadlight,
} from "@/lib/inventory/plastic-kit-headlight";
import {
  calculatePlasticKitAvailability,
  comparePlasticKitsForDisplay,
} from "@/lib/inventory/plastic-kits";
import { buildPlasticKitSavePayload } from "@/lib/inventory/plastic-kit-request";
import {
  getPlasticKitFamily,
  getPlasticKitModel,
  matchesPlasticKitSearch,
  PLASTIC_KIT_FAMILIES,
  type PlasticKitFamilyId,
} from "@/lib/inventory/plastic-kit-taxonomy";
import {
  normalizeInventoryText,
} from "@/lib/inventory/priority-lines";
import type { PlasticKitAvailability, PlasticKitDefinition } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const copySuffixPattern = /\s+\(copia(?: \d+)?\)$/i;
const PRIMARY_WAREHOUSE = "Principal";
type HeadlightChoice = "all" | "with" | "without" | "not-applicable";

function kitLine(kit: PlasticKitDefinition) {
  return kit.model?.trim() || kit.brand.trim();
}

function kitIncludesHeadlight(kit: PlasticKitDefinition) {
  return normalizePlasticKitHeadlight(kitLine(kit), kit.hasHeadlight);
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
  const [family, setFamily] = useState<"all" | PlasticKitFamilyId>("all");
  const [model, setModel] = useState("all");
  const [color, setColor] = useState("all");
  const [headlight, setHeadlight] = useState<HeadlightChoice>("all");
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
  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const kit of kits) {
      const kitFamily = getPlasticKitFamily(kit);
      counts.set(kitFamily, (counts.get(kitFamily) ?? 0) + 1);
    }
    return counts;
  }, [kits]);
  const selectedFamily = PLASTIC_KIT_FAMILIES.find((item) => item.id === family);
  const modelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const kit of kits) {
      if (family !== "all" && getPlasticKitFamily(kit) !== family) continue;
      const kitModel = normalizeInventoryText(getPlasticKitModel(kit));
      counts.set(kitModel, (counts.get(kitModel) ?? 0) + 1);
    }
    return counts;
  }, [family, kits]);
  const colorOptions = useMemo(() => {
    const options = new Map<string, { label: string; count: number }>();
    for (const kit of kits) {
      if (family !== "all" && getPlasticKitFamily(kit) !== family) continue;
      if (model !== "all" && normalizeInventoryText(getPlasticKitModel(kit)) !== model) continue;
      const key = normalizeInventoryText(kit.color);
      const currentOption = options.get(key);
      options.set(key, {
        label: currentOption?.label ?? kit.color,
        count: (currentOption?.count ?? 0) + 1,
      });
    }
    return [...options.entries()].sort(([, a], [, b]) =>
      a.label.localeCompare(b.label, "es"),
    );
  }, [family, kits, model]);
  const headlightCounts = useMemo(() => {
    let withHeadlight = 0;
    let withoutHeadlight = 0;
    let notApplicable = 0;
    for (const kit of kits) {
      const matchesFamily = family === "all" || getPlasticKitFamily(kit) === family;
      const matchesModel =
        model === "all" || normalizeInventoryText(getPlasticKitModel(kit)) === model;
      const matchesColor =
        color === "all" || normalizeInventoryText(kit.color) === color;
      if (!matchesFamily || !matchesModel || !matchesColor) continue;
      const headlightValue = kitIncludesHeadlight(kit);
      if (headlightValue === null) notApplicable += 1;
      else if (headlightValue) withHeadlight += 1;
      else withoutHeadlight += 1;
    }
    return { withHeadlight, withoutHeadlight, notApplicable };
  }, [color, family, kits, model]);
  const visibleKits = useMemo(() => {
    return kits.filter((kit) => {
      const matchesFamily = family === "all" || getPlasticKitFamily(kit) === family;
      const matchesModel =
        model === "all" || normalizeInventoryText(getPlasticKitModel(kit)) === model;
      const matchesColor =
        color === "all" || normalizeInventoryText(kit.color) === color;
      const headlightValue = kitIncludesHeadlight(kit);
      const matchesHeadlight =
        headlight === "all" ||
        (headlight === "with" && headlightValue === true) ||
        (headlight === "without" && headlightValue === false) ||
        (headlight === "not-applicable" && headlightValue === null);
      return (
        matchesFamily &&
        matchesModel &&
        matchesColor &&
        matchesHeadlight &&
        matchesPlasticKitSearch(kit, deferredQuery)
      );
    });
  }, [color, deferredQuery, family, headlight, kits, model]);

  const hasActiveSelection =
    family !== "all" ||
    model !== "all" ||
    color !== "all" ||
    headlight !== "all" ||
    query.trim().length > 0;

  function resetSelection() {
    setFamily("all");
    setModel("all");
    setColor("all");
    setHeadlight("all");
    setQuery("");
  }

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
        <Tabs defaultValue="cards">
          <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="font-display text-2xl uppercase">Kits configurados</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                El resultado cambia automáticamente después de cada nueva carga de inventario.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
              <TabsList className="grid w-full grid-cols-2 sm:w-auto [&_svg]:size-4">
                <TabsTrigger value="cards">
                  <LayoutGrid aria-hidden="true" /> Tarjetas
                </TabsTrigger>
                <TabsTrigger value="matrix">
                  <TableProperties aria-hidden="true" /> Matriz
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:flex-1 lg:w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Por nombre de kit, pieza o SKU…"
                  className="h-11 pl-10"
                  aria-label="Buscar kits"
                />
              </div>
            </div>
          </div>
          <section
            className="overflow-hidden rounded-2xl border bg-muted/25"
            aria-labelledby="kit-combination-title"
          >
            <div className="flex flex-col gap-3 border-b bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="kit-combination-title" className="font-display text-lg font-bold uppercase">
                    Explora tu combinación
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Elige la moto y luego refina solo lo que necesites.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge variant="secondary" className="min-h-8 rounded-full px-3 tabular-nums">
                  {visibleKits.length} {visibleKits.length === 1 ? "resultado" : "resultados"}
                </Badge>
                {hasActiveSelection ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 rounded-full"
                    onClick={resetSelection}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Ver todo
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">1</span>
                Elige la familia
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Elegir familia de moto">
                <Button
                  type="button"
                  variant={family === "all" ? "default" : "outline"}
                  className="h-auto min-h-14 justify-between rounded-xl px-3"
                  aria-pressed={family === "all"}
                  onClick={() => {
                    setFamily("all");
                    setModel("all");
                    setColor("all");
                    setHeadlight("all");
                  }}
                >
                  Todas <span className="text-xs opacity-75">{kits.length}</span>
                </Button>
                {PLASTIC_KIT_FAMILIES.map((item) => {
                  const count = familyCounts.get(item.id) ?? 0;
                  const selected = family === item.id;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className="h-auto min-h-14 justify-between rounded-xl px-3"
                      aria-pressed={selected}
                      aria-label={`${item.label}: ${count} kits`}
                      onClick={() => {
                        setFamily(item.id);
                        setModel("all");
                        setColor("all");
                        setHeadlight("all");
                      }}
                    >
                      {item.label} <span className="text-xs opacity-75">{count}</span>
                    </Button>
                  );
                })}
              </div>

              {selectedFamily?.models.length ? (
                <div className="rounded-xl border bg-background/70 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">2</span>
                    Ahora elige el modelo de {selectedFamily.label}
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Elegir modelo de ${selectedFamily.label}`}>
                    <Button
                      type="button"
                      size="sm"
                      variant={model === "all" ? "default" : "outline"}
                      className="min-h-11 rounded-full"
                      aria-pressed={model === "all"}
                      onClick={() => setModel("all")}
                    >
                      Todos los {selectedFamily.label}
                    </Button>
                    {selectedFamily.models.map((item) => {
                      const key = normalizeInventoryText(item);
                      const count = modelCounts.get(key) ?? 0;
                      return (
                        <Button
                          key={item}
                          type="button"
                          size="sm"
                          variant={model === key ? "default" : "outline"}
                          className="min-h-11 rounded-full"
                          aria-pressed={model === key}
                          onClick={() => {
                            setModel(key);
                            setColor("all");
                            setHeadlight("all");
                          }}
                        >
                          {item} <span className="text-xs opacity-70">{count}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 rounded-xl border bg-background/70 p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
                <div className="flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Afinar
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="kit-color-filter" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color</label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger id="kit-color-filter" aria-label="Filtrar por color">
                      <SelectValue>
                        {color === "all"
                          ? "Todos los colores"
                          : colorOptions.find(([key]) => key === color)?.[1].label ?? color}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los colores</SelectItem>
                      {colorOptions.map(([key, option]) => (
                        <SelectItem key={key} value={key}>{option.label} ({option.count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="kit-headlight-filter" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Farola</label>
                  <Select value={headlight} onValueChange={(value: HeadlightChoice) => setHeadlight(value)}>
                    <SelectTrigger id="kit-headlight-filter" aria-label="Filtrar por presentación de farola">
                      <SelectValue>
                        {{
                          all: "Todas las presentaciones",
                          with: "Con farola",
                          without: "Sin farola",
                          "not-applicable": "No aplica",
                        }[headlight]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las presentaciones</SelectItem>
                      <SelectItem value="with">Con farola ({headlightCounts.withHeadlight})</SelectItem>
                      <SelectItem value="without">Sin farola ({headlightCounts.withoutHeadlight})</SelectItem>
                      <SelectItem value="not-applicable">No aplica ({headlightCounts.notApplicable})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>
          </CardHeader>
          <TabsContent value="cards" className="mt-0">
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
                          <Badge
                            variant="secondary"
                            className="border border-foreground/15 bg-background/80 text-foreground shadow-sm backdrop-blur-sm dark:border-transparent dark:bg-secondary dark:text-secondary-foreground dark:shadow-none dark:backdrop-blur-none"
                          >
                            {getPlasticKitModel(kit)}
                          </Badge>
                          <Badge variant="outline" className="gap-1.5 bg-background/45">
                            <span className="plastic-kit-color-dot" aria-hidden="true" />
                            {kit.color}
                          </Badge>
                          {kit.hasHeadlight !== null &&
                            plasticKitLineSupportsHeadlight(kit.model ?? kit.brand) && (
                              <Badge variant="outline" className="bg-background/35">
                                {kit.hasHeadlight ? "Con farola" : "Sin farola"}
                              </Badge>
                            )}
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
                <p className="mt-4 font-semibold">{kits.length ? "No hay kits para esta combinación" : "Crea tu primer kit plástico"}</p>
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
          </TabsContent>
          <TabsContent value="matrix" className="mt-0">
            <CardContent>
              {visibleKits.length ? (
                <PlasticKitsMatrix
                  kits={visibleKits}
                  lowStockThreshold={lowStockThreshold}
                  onOpenKit={isAdmin ? openEdit : undefined}
                />
              ) : (
                <div className="grid min-h-64 place-items-center rounded-xl border border-dashed p-8 text-center">
                  <div className="max-w-md">
                    <TableProperties
                      className="mx-auto size-10 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="mt-4 font-semibold">
                      No hay kits para construir la matriz
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Prueba otra búsqueda o usa “Ver todo” para recuperar todas las combinaciones.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
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
