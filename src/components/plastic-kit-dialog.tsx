"use client";

import {
  Boxes,
  CircleAlert,
  LoaderCircle,
  PackagePlus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculatePlasticKitAvailability } from "@/lib/inventory/plastic-kits";
import { buildPlasticKitSavePayload } from "@/lib/inventory/plastic-kit-request";
import { PRIORITY_PRODUCT_LINES } from "@/lib/inventory/priority-lines";
import type {
  InventoryItem,
  PlasticKitDefinition,
  PlasticKitPartDefinition,
} from "@/types/inventory";

type FormState = {
  name: string;
  line: string;
  color: string;
  hasHeadlight: boolean;
  parts: PlasticKitPartDefinition[];
};

const PRIMARY_WAREHOUSE = "Principal";

const emptyForm: FormState = {
  name: "",
  line: "",
  color: "",
  hasHeadlight: false,
  parts: [],
};

function formFromKit(kit: PlasticKitDefinition | null): FormState {
  if (!kit) return emptyForm;
  return {
    name: kit.name,
    line: kit.model?.trim() || kit.brand.trim(),
    color: kit.color,
    hasHeadlight: kit.hasHeadlight,
    parts: kit.parts.map((part) => ({ ...part })),
  };
}

export function PlasticKitDialog({
  open,
  onOpenChange,
  kit,
  inventory,
  isDemo,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit: PlasticKitDefinition | null;
  inventory: InventoryItem[];
  isDemo: boolean;
  onSaved: (kit: PlasticKitDefinition) => void;
}) {
  const [form, setForm] = useState<FormState>(() => formFromKit(kit));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const inventoryOptions = useMemo(() => {
    const options = new Map<string, InventoryItem>();
    for (const item of inventory) {
      if (item.warehouse === PRIMARY_WAREHOUSE && !options.has(item.sku.trim())) {
        options.set(item.sku.trim(), item);
      }
    }
    return [...options.values()].sort((a, b) =>
      a.productName.localeCompare(b.productName, "es"),
    );
  }, [inventory]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    if (query.length < 2) return [];
    const selected = new Set(form.parts.map((part) => part.sku));
    return inventoryOptions
      .filter(
        (item) =>
          !selected.has(item.sku) &&
          (item.sku.toLocaleLowerCase("es").includes(query) ||
            item.productName.toLocaleLowerCase("es").includes(query)),
      )
      .slice(0, 8);
  }, [form.parts, inventoryOptions, search]);

  const preview = useMemo(() => {
    const draft: PlasticKitDefinition = {
      id: kit?.id ?? "preview",
      name: form.name || "Kit sin nombre",
      brand: form.line || "Sin línea",
      color: form.color || "Sin color",
      hasHeadlight: form.hasHeadlight,
      model: form.line || undefined,
      warehouse: PRIMARY_WAREHOUSE,
      active: true,
      parts: form.parts,
    };
    return calculatePlasticKitAvailability([draft], inventory)[0];
  }, [form, inventory, kit?.id]);

  const missingRequired =
    !form.name.trim() ||
    !form.line.trim() ||
    !form.color.trim();
  const tooFewParts = form.parts.length < 2;

  function addPart(item: InventoryItem) {
    const sku = item.sku.trim();
    setForm((value) => ({
      ...value,
      parts: [
        ...value.parts,
        {
          sku,
          productName: item.productName,
          quantityRequired: 1,
          position: value.parts.length,
        },
      ],
    }));
    setSearch("");
  }

  function removePart(sku: string) {
    setForm((value) => ({
      ...value,
      parts: value.parts
        .filter((part) => part.sku !== sku)
        .map((part, position) => ({ ...part, position })),
    }));
  }

  function updateQuantity(sku: string, rawValue: string) {
    const quantityRequired = Math.min(999, Math.max(1, Number(rawValue) || 1));
    setForm((value) => ({
      ...value,
      parts: value.parts.map((part) =>
        part.sku === sku ? { ...part, quantityRequired } : part,
      ),
    }));
  }

  async function save() {
    setSubmitted(true);
    if (missingRequired || tooFewParts) return;

    setSaving(true);
    try {
      const definition: PlasticKitDefinition = {
        id: kit?.id ?? crypto.randomUUID(),
        name: form.name.trim(),
        brand: form.line.trim(),
        color: form.color.trim(),
        hasHeadlight: form.hasHeadlight,
        model: form.line.trim(),
        warehouse: PRIMARY_WAREHOUSE,
        active: true,
        parts: form.parts.map((part, position) => ({ ...part, position })),
      };

      if (!isDemo) {
        const response = await fetch("/api/plastic-kits", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildPlasticKitSavePayload(definition, kit?.id)),
        });
        const body = (await response.json()) as { id?: string; message?: string };
        if (!response.ok) throw new Error(body.message || "No pudimos guardar el kit.");
        if (body.id) definition.id = body.id;
      }

      onSaved(definition);
      onOpenChange(false);
      toast.success(kit ? "Kit actualizado" : "Kit creado", {
        description: `${definition.name}: ${preview.available} unidades armables ahora.`,
      });
    } catch (error) {
      toast.error("No pudimos guardar el kit", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{kit ? "Editar kit plástico" : "Crear kit plástico"}</DialogTitle>
          <DialogDescription>
            Define la presentación y agrega las piezas individuales que se descuentan para armar una unidad.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="grid gap-4 rounded-xl border bg-card/45 p-4 sm:grid-cols-2" aria-labelledby="kit-details-title">
              <h3 id="kit-details-title" className="font-display text-lg font-bold uppercase sm:col-span-2">
                Datos del kit
              </h3>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="kit-name">Nombre del kit</Label>
                <Input
                  id="kit-name"
                  value={form.name}
                  aria-invalid={submitted && !form.name.trim()}
                  placeholder="Ej. Kit Boxer CT 100 negro"
                  onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="kit-line">Línea principal</Label>
                <Select
                  value={form.line}
                  onValueChange={(line) => setForm((value) => ({ ...value, line }))}
                >
                  <SelectTrigger
                    id="kit-line"
                    aria-invalid={submitted && !form.line.trim()}
                  >
                    <SelectValue placeholder="Selecciona una línea" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PRIORITY_PRODUCT_LINES.map((line) => (
                        <SelectItem key={line} value={line}>{line}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-color">Color</Label>
                <Input
                  id="kit-color"
                  value={form.color}
                  aria-invalid={submitted && !form.color.trim()}
                  placeholder="Ej. Negro"
                  onChange={(event) => setForm((value) => ({ ...value, color: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="kit-headlight">Farola</Label>
                <Select
                  value={form.hasHeadlight ? "with" : "without"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      hasHeadlight: value === "with",
                    }))
                  }
                >
                  <SelectTrigger id="kit-headlight">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="with">Con farola</SelectItem>
                      <SelectItem value="without">Sin farola</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="kit-parts-title">
              <div>
                <h3 id="kit-parts-title" className="font-display text-lg font-bold uppercase">Piezas del kit</h3>
                <p className="text-sm text-muted-foreground">Busca en el último inventario por referencia o nombre. Agrega mínimo dos piezas.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar SKU o pieza…"
                  className="pl-10"
                  aria-label="Buscar pieza para agregar"
                />
                {search.trim().length >= 2 && (
                  <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover shadow-xl">
                    {searchResults.length ? (
                      <div className="max-h-64 overflow-y-auto p-1">
                        {searchResults.map((item) => (
                          <button
                            key={`${item.warehouse}-${item.sku}`}
                            type="button"
                            onClick={() => addPart(item)}
                            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0">
                              <span className="block font-mono text-xs font-bold">{item.sku}</span>
                              <span className="block truncate text-sm">{item.productName}</span>
                            </span>
                            <Badge variant="secondary" className="shrink-0">{item.available} disp.</Badge>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="p-4 text-sm text-muted-foreground">No encontramos otra pieza en la bodega Principal.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {preview.parts.map((part) => (
                  <article key={part.sku} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold">{part.sku}</span>
                        {part.isLimiting && <Badge variant="outline">Limitante</Badge>}
                        {!part.hasInventoryRecord && <Badge variant="destructive">Sin inventario</Badge>}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium" title={part.productName}>{part.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{part.available} disponibles · alcanza para {part.kitCapacity} kits</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`part-quantity-${part.sku}`} className="text-xs">Unid. por kit</Label>
                      <Input
                        id={`part-quantity-${part.sku}`}
                        type="number"
                        min={1}
                        max={999}
                        value={part.quantityRequired}
                        onChange={(event) => updateQuantity(part.sku, event.target.value)}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePart(part.sku)} aria-label={`Quitar ${part.productName}`}>
                      <Trash2 />
                    </Button>
                  </article>
                ))}
                {!form.parts.length && (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <PackagePlus className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 font-medium">Aún no has agregado piezas</p>
                    <p className="mt-1 text-sm text-muted-foreground">Empieza buscando la primera referencia.</p>
                  </div>
                )}
              </div>
              {submitted && tooFewParts && (
                <p className="flex items-center gap-2 text-sm font-medium text-destructive" role="alert">
                  <CircleAlert className="size-4" /> Agrega al menos dos piezas.
                </p>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-primary/35 bg-primary/10 p-5 lg:sticky lg:top-0">
            <Boxes className="size-7 text-primary" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold text-muted-foreground">Disponibilidad calculada</p>
            <p className="mt-1 font-display text-5xl font-bold tabular-nums">{preview.available}</p>
            <p className="mt-1 text-sm">kits completos armables</p>
            <div className="my-4 h-px bg-border" />
            <p className="text-sm font-semibold">¿Cómo se calcula?</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Se divide el disponible de cada pieza por la cantidad requerida. El menor resultado define el inventario del kit.
            </p>
            {preview.parts.length > 0 && (
              <p className="mt-4 rounded-xl bg-background/70 p-3 text-sm">
                <span className="block font-semibold">Pieza limitante</span>
                <span className="mt-1 block text-muted-foreground">
                  {preview.parts.filter((part) => part.isLimiting).map((part) => part.productName).join(" · ")}
                </span>
              </p>
            )}
          </aside>
        </div>

        {submitted && missingRequired && (
          <p className="text-sm font-medium text-destructive" role="alert">Completa los campos obligatorios del kit.</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Boxes />}
            {saving ? "Guardando…" : kit ? "Guardar cambios" : "Crear kit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
