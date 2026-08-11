"use client";

import {
  CircleAlert,
  Grid3X3,
  PackageCheck,
  PackageX,
  Pencil,
} from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getPlasticKitColorStyle } from "@/lib/inventory/plastic-kit-colors";
import {
  buildPlasticKitMatrix,
  type PlasticKitMatrixGroup,
  type PlasticKitMatrixRow,
} from "@/lib/inventory/plastic-kit-matrix";
import type { PlasticKitAvailability } from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function headlightLabel(value: boolean) {
  return value ? "Con farola" : "Sin farola";
}

function AvailabilityBadge({
  available,
  threshold,
}: {
  available: number;
  threshold: number;
}) {
  if (available <= 0) {
    return (
      <Badge variant="destructive">
        <PackageX /> Agotado
      </Badge>
    );
  }
  if (available <= threshold) {
    return (
      <Badge
        variant="outline"
        className="border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
      >
        <CircleAlert /> Stock bajo
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    >
      <PackageCheck /> Disponible
    </Badge>
  );
}

function ColorLabel({ color }: { color: string }) {
  const colorStyle = getPlasticKitColorStyle(color);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="size-3.5 rounded-full border shadow-sm"
        style={{ backgroundColor: colorStyle.border }}
        aria-hidden="true"
      />
      <span>{color}</span>
    </span>
  );
}

function ColorAvailabilityCard({
  color,
  kits,
  lowStockThreshold,
  onOpenKit,
}: {
  color: string;
  kits: PlasticKitAvailability[];
  lowStockThreshold: number;
  onOpenKit?: (kit: PlasticKitAvailability) => void;
}) {
  const colorStyle = getPlasticKitColorStyle(color);

  return (
    <article
      className="plastic-kit-color-card overflow-hidden rounded-2xl border-2"
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
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-background/25 px-4 py-3">
        <h6 className="font-display text-base font-bold uppercase">
          <ColorLabel color={color} />
        </h6>
        {kits.length > 1 ? (
          <Badge variant="secondary" className="rounded-full">
            {kits.length} presentaciones
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-2 p-3">
        {kits.map((kit) => (
          <div
            key={kit.id}
            className="grid min-h-[5.25rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-background/75 p-2.5 shadow-sm"
          >
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              {kit.hasHeadlight !== null ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  {headlightLabel(kit.hasHeadlight)}
                </span>
              ) : null}
              <AvailabilityBadge
                available={kit.available}
                threshold={lowStockThreshold}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div className="text-right">
                <p className="font-display text-2xl font-bold leading-none tabular-nums">
                  {number.format(kit.available)}
                </p>
                <p className="mt-1 text-[0.65rem] font-bold uppercase text-muted-foreground">
                  armables
                </p>
              </div>
              {onOpenKit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => onOpenKit(kit)}
                  aria-label={`Editar ${kit.name}`}
                  title="Editar kit"
                >
                  <Pencil />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ModelColorGrid({
  group,
  row,
  lowStockThreshold,
  onOpenKit,
}: {
  group: PlasticKitMatrixGroup;
  row: PlasticKitMatrixRow;
  lowStockThreshold: number;
  onOpenKit?: (kit: PlasticKitAvailability) => void;
}) {
  const visibleColors = group.colors.filter((color) =>
    row.kitsByColor.has(color.key),
  );

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <h5 className="font-display text-base font-bold uppercase">
          {row.model}
        </h5>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleColors.map((color) => (
          <ColorAvailabilityCard
            key={color.key}
            color={color.label}
            kits={row.kitsByColor.get(color.key) ?? []}
            lowStockThreshold={lowStockThreshold}
            onOpenKit={onOpenKit}
          />
        ))}
      </div>
    </div>
  );
}

function PlasticKitLinePanel({
  group,
  lowStockThreshold,
  onOpenKit,
}: {
  group: PlasticKitMatrixGroup;
  lowStockThreshold: number;
  onOpenKit?: (kit: PlasticKitAvailability) => void;
}) {
  const firstRow = group.rows[0];
  if (!firstRow) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-background shadow-sm"
      aria-labelledby={`plastic-kit-line-${group.key}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3 sm:px-5">
        <div>
          <h4
            id={`plastic-kit-line-${group.key}`}
            className="font-display text-xl font-bold uppercase"
          >
            {group.label}
          </h4>
          <p className="text-sm text-muted-foreground">
            {group.rows.length} {group.rows.length === 1 ? "modelo" : "modelos"}
            {" · "}
            {group.colors.length} {group.colors.length === 1 ? "color único" : "colores únicos"}
          </p>
        </div>
        <Badge variant="outline" className="rounded-full bg-background px-3">
          Línea {group.label}
        </Badge>
      </div>

      {group.rows.length > 1 ? (
        <Tabs defaultValue={firstRow.key}>
          <div className="border-b bg-primary/5 p-3 sm:p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Elige el modelo que deseas consultar
            </p>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0">
              {group.rows.map((row) => (
                <TabsTrigger
                  key={row.key}
                  value={row.key}
                  className="flex-none rounded-full border bg-background px-4 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {row.model}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {group.rows.map((row) => (
            <TabsContent key={row.key} value={row.key} className="mt-0">
              <ModelColorGrid
                group={group}
                row={row}
                lowStockThreshold={lowStockThreshold}
                onOpenKit={onOpenKit}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <ModelColorGrid
          group={group}
          row={firstRow}
          lowStockThreshold={lowStockThreshold}
          onOpenKit={onOpenKit}
        />
      )}
    </section>
  );
}

export function PlasticKitsMatrix({
  kits,
  lowStockThreshold,
  onOpenKit,
}: {
  kits: PlasticKitAvailability[];
  lowStockThreshold: number;
  onOpenKit?: (kit: PlasticKitAvailability) => void;
}) {
  const matrix = useMemo(() => buildPlasticKitMatrix(kits), [kits]);

  return (
    <section className="space-y-4" aria-labelledby="plastic-kit-matrix-title">
      <div className="overflow-hidden rounded-2xl border">
        <div className="flex flex-col gap-4 border-b bg-primary/5 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Grid3X3 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3
                id="plastic-kit-matrix-title"
                className="font-display text-lg font-bold uppercase"
              >
                Vista compacta por línea
              </h3>
              <p className="text-sm text-muted-foreground">
                Elige un modelo y consulta todos sus colores sin desplazarte horizontalmente.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Leyenda de disponibilidad">
            <AvailabilityBadge
              available={lowStockThreshold + 1}
              threshold={lowStockThreshold}
            />
            <AvailabilityBadge
              available={Math.max(1, lowStockThreshold)}
              threshold={lowStockThreshold}
            />
            <AvailabilityBadge available={0} threshold={lowStockThreshold} />
          </div>
        </div>
        <div className="bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {matrix.groups.length}
          </span>{" "}
          {matrix.groups.length === 1 ? "línea visible" : "líneas visibles"}
          {" · "}
          <span className="font-semibold text-foreground tabular-nums">
            {kits.length}
          </span>{" "}
          {kits.length === 1 ? "kit configurado" : "kits configurados"}
        </div>
      </div>

      <div className="grid gap-4">
        {matrix.groups.map((group) => (
          <PlasticKitLinePanel
            key={`${group.key}:${group.rows.map((row) => row.key).join(",")}`}
            group={group}
            lowStockThreshold={lowStockThreshold}
            onOpenKit={onOpenKit}
          />
        ))}
      </div>
    </section>
  );
}
