"use client";

import {
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImportRun } from "@/types/inventory";

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});
const timeOnly = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });
const dayLabelFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

function visibleErrorMessage(message: string) {
  if (
    message ===
    "No pudimos publicar el inventario. La carga anterior sigue vigente."
  ) {
    return "La publicación falló. Revisa el archivo e intenta nuevamente.";
  }
  return message;
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) {
    return `Hoy · ${dayLabelFormat.format(date)}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Ayer · ${dayLabelFormat.format(date)}`;
  }
  return dayLabelFormat.format(date);
}

/** Agrupa las cargas por día calendario para el separador de línea de tiempo
 *  (README §"08 · Historial") — pura derivación de `createdAt`, ya presente
 *  en cada `ImportRun`. */
function groupByDay(runs: ImportRun[]) {
  const groups: Array<{ key: string; label: string; runs: ImportRun[] }> = [];
  for (const run of runs) {
    const key = dayKey(run.createdAt);
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.runs.push(run);
    else groups.push({ key, label: dayLabel(run.createdAt), runs: [run] });
  }
  return groups;
}

export function HistoryPage() {
  const { importRuns, snapshots } = useInventoryData();
  const success = importRuns.filter((run) => run.status === "completed").length;
  const failed = importRuns.filter((run) => run.status === "failed").length;
  const groups = groupByDay(importRuns);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Historial de cargas"
        subtitle={`${importRuns.length} cargas registradas · ${snapshots.length} instantáneas retenidas`}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            {
              label: "Cargas correctas",
              value: success,
              icon: CheckCircle2,
              cardClassName: "border-primary/25",
              iconClassName: "bg-primary/15 text-primary dark:text-primary",
            },
            {
              label: "Cargas rechazadas",
              value: failed,
              icon: XCircle,
              cardClassName: "border-destructive/25",
              iconClassName: "bg-destructive/10 text-destructive",
            },
            {
              label: "Instantáneas retenidas",
              value: snapshots.length,
              icon: Clock3,
              cardClassName: "",
              iconClassName: "bg-muted text-foreground",
            },
          ] satisfies Array<{
            label: string;
            value: number;
            icon: LucideIcon;
            cardClassName: string;
            iconClassName: string;
          }>
        ).map(({ label, value, icon: Icon, cardClassName, iconClassName }) => (
          <Card key={label} className={cardClassName}>
            <CardContent className="flex min-h-24 items-center gap-3 p-4 sm:p-5">
              <div
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  iconClassName,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-col justify-center gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="font-display text-2xl font-bold leading-none tabular-nums">
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Registro de importaciones
          </CardTitle>
          <CardDescription>
            Las fallidas se conservan como evidencia, pero no modifican existencias.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-0 pb-4">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col">
              <p className="border-b bg-table-header px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              <div className="divide-y divide-row-separator">
                {group.runs.map((run) => {
                  const failedRun = run.status === "failed";
                  const applied = failedRun ? 0 : run.itemCount;
                  return (
                    <div
                      key={run.id}
                      className={cn(
                        "grid grid-cols-[16px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[16px_minmax(0,1fr)_190px_120px_auto]",
                        failedRun && "shadow-[inset_3px_0_0_hsl(var(--destructive))]",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2.5 justify-self-center rounded-full",
                          failedRun ? "bg-destructive" : "bg-success",
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-[13.5px] font-semibold">
                          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          {run.filename}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {timeOnly.format(new Date(run.createdAt))} · Usuario autorizado
                        </p>
                        {run.errorMessage && (
                          <p className="mt-1 max-w-md text-xs text-destructive">
                            {visibleErrorMessage(run.errorMessage)}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        {!failedRun && (
                          <>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full w-full rounded-full bg-success" />
                            </div>
                            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                              {applied.toLocaleString("es-CO")}/{run.itemCount.toLocaleString("es-CO")} filas
                            </p>
                          </>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-[13px] font-semibold",
                          failedRun ? "text-destructive" : "text-success",
                        )}
                      >
                        {run.status === "completed"
                          ? "Completada"
                          : run.status === "processing"
                            ? "Procesando"
                            : "Rechazada"}
                      </p>
                      <Badge variant="outline" className="w-fit justify-self-start text-[11px] sm:justify-self-end">
                        {run.sourceExportedAt ? dateTime.format(new Date(run.sourceExportedAt)) : "—"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {importRuns.length === 0 && (
            <div className="grid min-h-40 place-items-center px-4 text-center">
              <div>
                <History className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-semibold">Todavía no hay cargas registradas</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
