"use client";

import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Grid3X3,
  LayoutGrid,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Trash2,
  Wrench,
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
import { EmptyState } from "@/components/ui/empty-state";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlasticKitColorStyle } from "@/lib/inventory/plastic-kit-colors";
import { normalizePlasticKitHeadlight } from "@/lib/inventory/plastic-kit-headlight";
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
import { cn } from "@/lib/utils";
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

function kitFamilyLabel(kit: PlasticKitDefinition) {
  const family = getPlasticKitFamily(kit);
  return PLASTIC_KIT_FAMILIES.find((item) => item.id === family)?.label ?? "Otra línea";
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

function kitLevel(kit: PlasticKitAvailability, threshold: number): "exhausted" | "low" | "ok" {
  if (kit.available <= 0) return "exhausted";
  if (kit.available <= threshold) return "low";
  return "ok";
}

function KitLevelLabel({ kit, threshold }: { kit: PlasticKitAvailability; threshold: number }) {
  const level = kitLevel(kit, threshold);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] font-bold",
        level === "exhausted" && "text-destructive",
        level === "low" && "text-warning",
        level === "ok" && "text-success",
      )}
    >
      <span
        className={cn(
          "size-[7px] rounded-full",
          level === "exhausted" && "bg-destructive",
          level === "low" && "bg-primary",
          level === "ok" && "bg-success",
        )}
        aria-hidden="true"
      />
      {level === "exhausted" ? "Agotado" : level === "low" ? "Bajo" : "Disponible"}
    </span>
  );
}

function ColorSwatch({ color, className }: { color: string; className?: string }) {
  const style = getPlasticKitColorStyle(color);
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full border", className)}
      style={{ background: style.surface, borderColor: style.border }}
      aria-hidden="true"
    />
  );
}

function FeaturedKitCard({
  kit,
  position,
  threshold,
}: {
  kit: PlasticKitAvailability;
  position: number;
  threshold: number;
}) {
  const colorStyle = getPlasticKitColorStyle(kit.color);
  const limitingPart = kit.parts.find((part) => part.isLimiting) ?? kit.parts[0];

  return (
    <article
      className="relative min-h-[174px] overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:shadow-lg motion-reduce:transition-none"
      style={{ borderColor: colorStyle.border }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full opacity-70 blur-2xl"
        style={{ backgroundColor: colorStyle.surface }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl border"
              style={{ backgroundColor: colorStyle.surface, borderColor: colorStyle.border }}
            >
              <Boxes className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Capacidad #{position}
              </p>
              <h3 className="mt-1 truncate font-display text-lg font-bold uppercase">
                {getPlasticKitModel(kit)}
              </h3>
            </div>
          </div>
          <ColorSwatch color={kit.color} className="size-7 border-2 shadow-sm" />
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-[38px] font-bold leading-none tabular-nums">
              {number.format(kit.available)}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">kits armables</p>
          </div>
          <div className="text-right">
            <KitLevelLabel kit={kit} threshold={threshold} />
            <p className="mt-1 text-xs font-semibold">{kit.color}</p>
          </div>
        </div>

        {limitingPart ? (
          <p className="mt-auto truncate border-t pt-3 text-xs text-muted-foreground">
            Limita <strong className="font-semibold text-foreground">{limitingPart.productName}</strong>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function KitGalleryCard({
  kit,
  threshold,
  maxAvailable,
  isAdmin,
  duplicating,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  kit: PlasticKitAvailability;
  threshold: number;
  maxAvailable: number;
  isAdmin: boolean;
  duplicating: boolean;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colorStyle = getPlasticKitColorStyle(kit.color);
  const limitingPart = kit.parts.find((part) => part.isLimiting) ?? kit.parts[0];
  const capacityPercent = Math.max(4, Math.round((kit.available / maxAvailable) * 100));
  const headlightValue = kitIncludesHeadlight(kit);

  return (
    <article
      className="plastic-kit-color-card group overflow-hidden rounded-2xl border bg-card shadow-sm transition-[box-shadow,border-color] duration-200 hover:shadow-lg motion-reduce:transition-none"
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
      <div className="relative overflow-hidden border-b bg-background/80 p-5">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full border-[18px] opacity-30"
          style={{ borderColor: colorStyle.border }}
          aria-hidden="true"
        />
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{kitFamilyLabel(kit)}</Badge>
            <Badge variant="outline" className="bg-background/80 text-foreground">
              <ColorSwatch color={kit.color} className="size-3" />
              {kit.color}
            </Badge>
          </div>
          <h3 className="mt-4 line-clamp-2 font-display text-xl font-bold uppercase leading-tight text-foreground" title={kit.name}>
            {kit.name}
          </h3>
          <p className="mt-1 text-xs font-semibold text-foreground/75">
            {getPlasticKitModel(kit)} · {kit.parts.length} piezas configuradas
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Capacidad actual
            </p>
            <p className="mt-1 font-display text-[38px] font-bold leading-none tabular-nums">
              {number.format(kit.available)}
              <span className="ml-2 font-sans text-xs font-semibold normal-case text-muted-foreground">
                kits
              </span>
            </p>
          </div>
          <KitLevelLabel kit={kit} threshold={threshold} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Capacidad frente al mejor kit</span>
            <span className="tabular-nums">{capacityPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn(
                "h-full rounded-full",
                kit.available <= 0 && "bg-destructive",
                kit.available > 0 && kit.available <= threshold && "bg-primary",
                kit.available > threshold && "bg-success",
              )}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-muted/35 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Composición</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{kit.parts.length} piezas</p>
          </div>
          <div className="rounded-xl border bg-muted/35 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Farola</p>
            <p className="mt-1 truncate text-sm font-bold">
              {headlightValue === null ? "No aplica" : headlightValue ? "Incluida" : "Sin farola"}
            </p>
          </div>
        </div>

        {limitingPart ? (
          <div className="rounded-xl border border-primary/35 bg-primary/10 p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-warning">
              <Wrench className="size-3.5" aria-hidden="true" />
              Pieza limitante
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold" title={limitingPart.productName}>
              {limitingPart.productName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              SKU {limitingPart.sku} · {number.format(limitingPart.available)} disponibles
            </p>
          </div>
        ) : null}

        <details className="group/details rounded-xl border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Ver composición completa
            <ChevronDown className="size-4 transition-transform group-open/details:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-2 border-t p-3">
            {kit.parts.map((part) => (
              <div key={part.sku} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate" title={part.productName}>{part.productName}</span>
                <span className="shrink-0 font-bold tabular-nums">{number.format(part.available)} disp.</span>
              </div>
            ))}
          </div>
        </details>

        {isAdmin ? (
          <div className="flex items-center gap-2 border-t pt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
            <Button variant="ghost" size="icon" disabled={duplicating} onClick={onDuplicate} aria-label={`Duplicar ${kit.name}`}>
              {duplicating ? <LoaderCircle className="animate-spin" /> : <Copy />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Eliminar ${kit.name}`}>
              <Trash2 />
            </Button>
          </div>
        ) : null}
      </div>
    </article>
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
  const [exporting, setExporting] = useState(false);
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
  const armableToday = kits.filter((kit) => kit.available > 0).length;
  const readiness = kits.length ? Math.round((armableToday / kits.length) * 100) : 0;
  const limitingParts = new Set(kits.flatMap((kit) => kit.limitingPartSkus)).size;
  const bestKit = kits.reduce<PlasticKitAvailability | null>(
    (best, kit) => (!best || kit.available > best.available ? kit : best),
    null,
  );
  const featuredKits = [...kits]
    .filter((kit) => kit.available > 0)
    .sort((a, b) => b.available - a.available)
    .slice(0, 3);
  const maxVisibleAvailability = Math.max(
    1,
    ...visibleKits.map((kit) => kit.available),
  );

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

  async function exportKits() {
    setExporting(true);
    try {
      const { downloadPlasticKitsExcel } = await import(
        "@/lib/inventory/export-plastic-kits"
      );
      downloadPlasticKitsExcel(kits);
      toast.success("Excel descargado", {
        description: "La disponibilidad de kits se exportó en formato .xlsx.",
      });
    } catch (error) {
      toast.error("No pudimos exportar el Excel", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kit Plástico"
        subtitle={`${kits.length} combinaciones modelo · color — ${armableToday} armables hoy`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportKits}
              disabled={kits.length === 0 || exporting}
            >
              {exporting ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {exporting ? "Generando Excel" : "Exportar Excel"}
            </Button>
            {isAdmin && (
              <Button onClick={openCreate}>
                <Plus data-icon="inline-start" />
                Definir kit
              </Button>
            )}
          </>
        }
      />

      <section className="relative overflow-hidden rounded-2xl border border-secondary bg-secondary text-secondary-foreground shadow-lg">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden="true"
        />
        <div className="relative grid gap-8 p-5 pt-7 sm:p-7 sm:pt-9 lg:grid-cols-[minmax(0,1fr)_minmax(430px,0.85fr)] lg:items-center">
          <div>
            <Badge className="border border-primary/50 bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Taller de kits
            </Badge>
            <h2 className="mt-5 max-w-[17ch] font-display text-[38px] font-bold uppercase leading-[0.92] sm:text-5xl">
              Convierte piezas en kits listos para vender.
            </h2>
            <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-secondary-foreground/70">
              Cruza el inventario de cada pieza y descubre de inmediato qué modelos y colores puedes armar hoy.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-secondary-foreground/20 bg-secondary-foreground/10 text-secondary-foreground">
                <PackageCheck className="size-3.5" aria-hidden="true" />
                {armableToday} combinaciones listas
              </Badge>
              <Badge variant="outline" className="border-secondary-foreground/20 bg-secondary-foreground/10 text-secondary-foreground">
                <Wrench className="size-3.5" aria-hidden="true" />
                {limitingParts} piezas limitantes
              </Badge>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-secondary-foreground/15 bg-secondary-foreground/[0.06] p-4 backdrop-blur-sm sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
            <div className="relative mx-auto grid size-32 place-items-center rounded-full bg-secondary-foreground/10 p-2">
              <div
                className="absolute inset-2 rounded-full"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${readiness}%, hsl(var(--secondary-foreground) / 0.12) ${readiness}%)`,
                }}
                aria-hidden="true"
              />
              <div className="relative grid size-[92px] place-items-center rounded-full bg-secondary text-center shadow-inner">
                <div>
                  <p className="font-display text-3xl font-bold text-primary tabular-nums">{readiness}%</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-secondary-foreground/55">operativo</p>
                </div>
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-secondary-foreground/10 bg-secondary-foreground/[0.06] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-foreground/55">
                Capacidad total hoy
              </p>
              <p className="mt-1 font-display text-4xl font-bold text-primary tabular-nums">
                {number.format(totalStock)}
              </p>
              <p className="text-xs text-secondary-foreground/65">kits posibles entre todas las combinaciones</p>
              {bestKit ? (
                <div className="mt-4 border-t border-secondary-foreground/15 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary-foreground/50">Mayor capacidad</p>
                  <p className="mt-1 truncate text-sm font-semibold">{getPlasticKitModel(bestKit)} · {bestKit.color}</p>
                  <p className="mt-0.5 text-xs text-secondary-foreground/60">{number.format(bestKit.available)} kits armables</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {featuredKits.length ? (
        <section aria-labelledby="featured-kits-title">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Producción inmediata</p>
              <h2 id="featured-kits-title" className="mt-1 font-display text-2xl font-bold uppercase">Listos para armar</h2>
            </div>
            <p className="text-sm text-muted-foreground">Las tres combinaciones con mayor capacidad disponible.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {featuredKits.map((kit, index) => (
              <FeaturedKitCard
                key={kit.id}
                kit={kit}
                position={index + 1}
                threshold={lowStockThreshold}
              />
            ))}
          </div>
        </section>
      ) : null}

      <Card>
        <Tabs defaultValue="gallery">
          <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="font-display text-2xl uppercase">Kits configurados</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                El resultado cambia automáticamente después de cada nueva carga de inventario.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
              <TabsList className="grid w-full grid-cols-3 sm:w-auto [&_svg]:size-4">
                <TabsTrigger value="gallery">
                  <LayoutGrid aria-hidden="true" /> Galería
                </TabsTrigger>
                <TabsTrigger value="table">
                  <TableProperties aria-hidden="true" /> Tabla
                </TabsTrigger>
                <TabsTrigger value="matrix">
                  <Grid3X3 aria-hidden="true" /> Matriz
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:flex-1 lg:w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Por nombre de kit, pieza o SKU…"
                  className="h-[38px] pl-10"
                  aria-label="Buscar kits"
                />
              </div>
            </div>
          </div>
          <section
            className="overflow-hidden rounded-2xl border bg-muted/25"
            aria-labelledby="kit-combination-title"
          >
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                  <Sparkles className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="kit-combination-title" className="font-display text-base font-bold uppercase">
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
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-background">1</span>
                Elige la familia
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Elegir familia de moto">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto min-h-14 justify-between rounded-xl px-3",
                    family === "all" && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
                  )}
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
                      variant="outline"
                      className={cn(
                        "h-auto min-h-14 justify-between rounded-xl px-3",
                        selected && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
                      )}
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
                    <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-foreground text-background">2</span>
                    Ahora elige el modelo de {selectedFamily.label}
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Elegir modelo de ${selectedFamily.label}`}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "min-h-11 rounded-full",
                        model === "all" && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
                      )}
                      aria-pressed={model === "all"}
                      onClick={() => setModel("all")}
                    >
                      Todos los {selectedFamily.label}
                    </Button>
                    {selectedFamily.models.map((item) => {
                      const key = normalizeInventoryText(item);
                      const count = modelCounts.get(key) ?? 0;
                      const selected = model === key;
                      return (
                        <Button
                          key={item}
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            "min-h-11 rounded-full",
                            selected && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
                          )}
                          aria-pressed={selected}
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
                        <span className="flex items-center gap-2">
                          {color !== "all" && <ColorSwatch color={colorOptions.find(([key]) => key === color)?.[1].label ?? color} className="size-3.5" />}
                          {color === "all"
                            ? "Todos los colores"
                            : colorOptions.find(([key]) => key === color)?.[1].label ?? color}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">Todos los colores</SelectItem>
                        {colorOptions.map(([key, option]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <ColorSwatch color={option.label} className="size-3.5" />
                              {option.label} ({option.count})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
                      <SelectGroup>
                        <SelectItem value="all">Todas las presentaciones</SelectItem>
                        <SelectItem value="with">Con farola ({headlightCounts.withHeadlight})</SelectItem>
                        <SelectItem value="without">Sin farola ({headlightCounts.withoutHeadlight})</SelectItem>
                        <SelectItem value="not-applicable">No aplica ({headlightCounts.notApplicable})</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>
          </CardHeader>
          <TabsContent value="gallery" className="mt-0">
            <CardContent className="pt-0">
              {visibleKits.length ? (
                <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {visibleKits.map((kit) => (
                    <KitGalleryCard
                      key={kit.id}
                      kit={kit}
                      threshold={lowStockThreshold}
                      maxAvailable={maxVisibleAvailability}
                      isAdmin={isAdmin}
                      duplicating={duplicatingId === kit.id}
                      onDuplicate={() => void duplicateKit(kit)}
                      onEdit={() => openEdit(kit)}
                      onDelete={() => setDeleteTarget(kit)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  tone={kits.length ? "neutral" : "brand"}
                  title={kits.length ? "No hay kits para esta combinación" : "Crea tu primer kit plástico"}
                  description={
                    kits.length
                      ? "Prueba otra búsqueda o selecciona todas las líneas."
                      : "Selecciona aquí las piezas individuales que componen cada combo."
                  }
                  action={
                    kits.length ? (
                      <Button variant="outline" onClick={resetSelection}>
                        Limpiar filtros
                      </Button>
                    ) : isAdmin ? (
                      <Button onClick={openCreate}>
                        <Plus data-icon="inline-start" />
                        Crear primer kit
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </CardContent>
          </TabsContent>
          <TabsContent value="table" className="mt-0">
            <CardContent className="p-0 pb-2">
          {visibleKits.length ? (
            <div>
              <div className="hidden grid-cols-[minmax(0,1fr)_150px_110px_110px_34px] gap-3 border-y bg-table-header px-5 py-0 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground lg:grid">
                <span className="flex h-10 items-center">Kit</span>
                <span className="flex h-10 items-center">Pieza que limita</span>
                <span className="flex h-10 items-center justify-end">Piezas</span>
                <span className="flex h-10 items-center justify-end">Kits armables</span>
                <span className="flex h-10 items-center" aria-hidden="true" />
              </div>
              <div className="divide-y divide-row-separator">
                {visibleKits.map((kit) => {
                  const limitingPart = kit.parts.find((part) => part.isLimiting) ?? kit.parts[0];
                  const level = kitLevel(kit, lowStockThreshold);
                  return (
                    <details key={kit.id} className="group">
                      <summary className="grid min-h-[62px] cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden lg:grid-cols-[minmax(0,1fr)_150px_110px_110px_34px] lg:px-5 lg:py-0">
                        <div className="flex min-h-12 min-w-0 items-center gap-2.5 py-2">
                          <ColorSwatch color={kit.color} className="size-6 rounded-[7px] border-2" />
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-semibold">
                              {getPlasticKitModel(kit)} · {kit.color}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                              {kit.parts.length} piezas · {kit.name}
                            </p>
                          </div>
                        </div>
                        <div className="hidden min-w-0 lg:block">
                          {limitingPart && (
                            <p
                              className={cn(
                                "truncate text-xs font-semibold",
                                level === "exhausted" && "text-destructive",
                                level === "low" && "text-warning",
                                level === "ok" && "text-muted-foreground",
                              )}
                            >
                              {limitingPart.productName} · {number.format(limitingPart.available)}
                            </p>
                          )}
                        </div>
                        <p className="hidden text-right text-[13px] text-muted-foreground tabular-nums lg:block">
                          {kit.parts.length}
                        </p>
                        <p className="hidden text-right font-display text-[22px] leading-none tabular-nums lg:block">
                          {number.format(kit.available)}
                        </p>
                        <ChevronRight
                          className="col-start-2 row-start-1 size-4 shrink-0 justify-self-end text-muted-foreground transition-transform group-open:rotate-90 lg:col-start-5 lg:justify-self-center"
                          aria-hidden="true"
                        />
                        <div className="col-span-2 flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground lg:hidden">
                          <KitLevelLabel kit={kit} threshold={lowStockThreshold} />
                          {limitingPart && (
                            <span className={cn(level === "exhausted" && "text-destructive", level === "low" && "text-warning")}>
                              limita: {limitingPart.productName} · {number.format(limitingPart.available)}
                            </span>
                          )}
                          <span className="ml-auto font-display text-lg text-foreground">
                            {number.format(kit.available)} kits
                          </span>
                        </div>
                      </summary>
                      <div className="flex flex-col gap-3 bg-row-alt px-4 py-3 pl-[35px] md:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <KitLevelLabel kit={kit} threshold={lowStockThreshold} />
                          {isAdmin && (
                            <div className="ml-auto flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                disabled={duplicatingId === kit.id}
                                onClick={() => void duplicateKit(kit)}
                                aria-label={`Duplicar ${kit.name}`}
                                title="Duplicar kit"
                              >
                                {duplicatingId === kit.id ? (
                                  <LoaderCircle className="size-4 animate-spin" />
                                ) : (
                                  <Copy className="size-4" />
                                )}
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(kit)} aria-label={`Editar ${kit.name}`}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => setDeleteTarget(kit)} aria-label={`Eliminar ${kit.name}`}>
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {kit.parts.map((part) => (
                            <div
                              key={part.sku}
                              className={cn(
                                "rounded-lg border bg-card p-2.5",
                                part.isLimiting && "border-primary/50 bg-primary/10",
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold">{part.sku}</span>
                                {part.isLimiting && (
                                  <span className="text-[10px] font-bold uppercase text-warning">limitante</span>
                                )}
                                {!part.hasInventoryRecord && (
                                  <Badge variant="destructive" className="text-[10px]">No llegó</Badge>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs" title={part.productName}>{part.productName}</p>
                              <p className="mt-1 text-xs">
                                <span className="font-bold tabular-nums">{number.format(part.available)}</span> disp. ·{" "}
                                <span className="text-muted-foreground">{part.quantityRequired} por kit · {part.kitCapacity} kits</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={Boxes}
                tone={kits.length ? "neutral" : "brand"}
                title={kits.length ? "No hay kits para esta combinación" : "Crea tu primer kit plástico"}
                description={
                  kits.length
                    ? "Prueba otra búsqueda o selecciona todas las líneas."
                    : "Selecciona aquí las piezas individuales que componen cada combo."
                }
                action={
                  !kits.length && isAdmin ? (
                    <Button onClick={openCreate}>
                      <Plus data-icon="inline-start" />
                      Crear primer kit
                    </Button>
                  ) : kits.length ? (
                    <Button variant="outline" onClick={resetSelection}>
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
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
                <EmptyState
                  icon={TableProperties}
                  title="No hay kits para construir la matriz"
                  description="Prueba otra búsqueda o usa “Ver todo” para recuperar todas las combinaciones."
                />
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
