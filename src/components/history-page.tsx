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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dateTime = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
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

export function HistoryPage() {
  const { importRuns, snapshots } = useInventoryData();
  const success = importRuns.filter((run) => run.status === "completed").length;
  const failed = importRuns.filter((run) => run.status === "failed").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Trazabilidad operativa"
        title="Historial de cargas"
        description="Consulta qué archivo se procesó, cuándo ocurrió y si llegó a convertirse en inventario vigente."
        icon={History}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            { label: "Cargas correctas", value: success, icon: CheckCircle2 },
            { label: "Cargas rechazadas", value: failed, icon: XCircle },
            {
              label: "Instantáneas retenidas",
              value: snapshots.length,
              icon: Clock3,
            },
          ] satisfies Array<{ label: string; value: number; icon: LucideIcon }>
        ).map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary-foreground">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
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
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Filas</TableHead>
                <TableHead>Fecha del archivo</TableHead>
                <TableHead>Procesado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <FileSpreadsheet className="size-4 text-primary" />
                      {run.filename}
                    </div>
                    {run.errorMessage && (
                      <p className="mt-1 max-w-md text-xs text-destructive">
                        {visibleErrorMessage(run.errorMessage)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        run.status === "failed"
                          ? "destructive"
                          : run.status === "processing"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {run.status === "completed"
                        ? "Completada"
                        : run.status === "processing"
                          ? "Procesando"
                          : "Rechazada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{run.itemCount}</TableCell>
                  <TableCell>
                    {run.sourceExportedAt
                      ? dateTime.format(new Date(run.sourceExportedAt))
                      : "—"}
                  </TableCell>
                  <TableCell>{dateTime.format(new Date(run.createdAt))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
