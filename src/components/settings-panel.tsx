"use client";

import {
  CheckCircle2,
  Clock3,
  MailWarning,
  Save,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmailDeliveryAttempt } from "@/types/inventory";

const emailDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function SettingsPanel({
  initialLowStockThreshold,
  initialEmailAttempts,
  isDemo,
}: {
  initialLowStockThreshold: number;
  initialEmailAttempts: EmailDeliveryAttempt[];
  isDemo: boolean;
}) {
  const profile = useProfile();
  const [threshold, setThreshold] = useState(initialLowStockThreshold);
  const [saving, setSaving] = useState(false);
  const isAdmin = profile.role === "admin";

  async function save() {
    setSaving(true);
    try {
      if (!isDemo) {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lowStockThreshold: threshold }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success("Configuración guardada", {
        description: `Inventario bajo: ${threshold} unidades o menos.`,
      });
    } catch (error) {
      toast.error("No pudimos guardar", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reglas del portal"
        title="Configuración"
        description="Ajusta los criterios que alimentan alertas, rankings y gráficas."
        icon={Settings2}
      />
      <section className="max-w-2xl">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Umbral de inventario bajo
          </CardTitle>
          <CardDescription>
            Se considera bajo cuando el disponible es mayor que cero y menor o
            igual al umbral.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="threshold">Unidades disponibles</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={9999}
              value={threshold}
              disabled={!isAdmin}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="max-w-48"
            />
          </div>
          <Alert>
            <ShieldCheck />
            <AlertTitle>Cambio auditable</AlertTitle>
            <AlertDescription>
              Este valor sirve para las vistas generales del inventario. Las
              alertas de recompra usan el mínimo configurado en cada producto.
            </AlertDescription>
          </Alert>
          <Button className="w-fit" disabled={!isAdmin || saving} onClick={save}>
            <Save /> {saving ? "Guardando…" : "Guardar regla"}
          </Button>
        </CardContent>
      </Card>

      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="font-display text-2xl uppercase">
                Registro de correos
              </CardTitle>
              <CardDescription className="mt-1">
                Últimos intentos de envío de alertas de reposición mediante Brevo.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit gap-2">
              <Clock3 aria-hidden="true" />
              Últimos {initialEmailAttempts.length} intentos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {initialEmailAttempts.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
              <MailWarning className="size-7 text-primary" aria-hidden="true" />
              <p className="mt-3 font-semibold">Aún no hay intentos registrados</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                El próximo correo de reposición mostrará aquí si Brevo lo aceptó o
                qué error impidió enviarlo.
              </p>
            </div>
          ) : (
            <Table aria-label="Historial de intentos de correo">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Publicación</TableHead>
                  <TableHead className="text-right">Alertas</TableHead>
                  <TableHead>Detalle de Brevo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialEmailAttempts.map((attempt) => {
                  const sent = attempt.status === "sent";
                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="min-w-40 whitespace-nowrap">
                        {emailDateFormatter.format(new Date(attempt.createdAt))}
                        {attempt.durationMs !== undefined && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {attempt.durationMs.toLocaleString("es-CO")} ms
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sent ? "default" : "destructive"}
                          className="gap-1.5"
                        >
                          {sent ? (
                            <CheckCircle2 aria-hidden="true" />
                          ) : (
                            <XCircle aria-hidden="true" />
                          )}
                          {sent ? "Aceptado" : "Falló"}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-56">
                        {attempt.recipientName && (
                          <span className="block font-semibold">
                            {attempt.recipientName}
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {attempt.recipientEmail}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <span className="block font-semibold">
                          {attempt.filename}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {attempt.subject}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-semibold">{attempt.alertCount}</span>
                        <span className="mt-1 block whitespace-nowrap text-xs text-muted-foreground">
                          {attempt.suggestedUnits.toLocaleString("es-CO")} unidades
                        </span>
                      </TableCell>
                      <TableCell className="min-w-72 max-w-md">
                        <span className={sent ? "text-sm" : "text-sm text-destructive"}>
                          {sent
                            ? attempt.providerResponse || "Brevo aceptó el correo."
                            : attempt.errorMessage || "Error sin detalle."}
                        </span>
                        {(attempt.providerMessageId || attempt.errorCode) && (
                          <span className="mt-1 block break-all text-xs text-muted-foreground">
                            {attempt.providerMessageId
                              ? `ID: ${attempt.providerMessageId}`
                              : `Código: ${attempt.errorCode}`}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
