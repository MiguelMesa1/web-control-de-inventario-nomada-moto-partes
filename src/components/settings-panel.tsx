"use client";

import {
  BellRing,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MailWarning,
  RotateCcw,
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
  normalizeInventoryText,
  PRIORITY_PRODUCT_LINES,
} from "@/lib/inventory/priority-lines";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EmailDeliveryAttempt,
  ReorderLineSetting,
} from "@/types/inventory";

const number = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

const emailDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function SettingsPanel({
  initialLowStockThreshold,
  initialLineSettings,
  initialEmailAttempts,
  isDemo,
}: {
  initialLowStockThreshold: number;
  initialLineSettings: ReorderLineSetting[];
  initialEmailAttempts: EmailDeliveryAttempt[];
  isDemo: boolean;
}) {
  const profile = useProfile();
  const [threshold, setThreshold] = useState(initialLowStockThreshold);
  const [saving, setSaving] = useState(false);
  const [lineDrafts, setLineDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialLineSettings.map((setting) => [
        normalizeInventoryText(setting.productLine),
        String(setting.reorderPoint),
      ]),
    ),
  );
  const [customLines, setCustomLines] = useState(
    () =>
      new Set(
        initialLineSettings.map((setting) =>
          normalizeInventoryText(setting.productLine),
        ),
      ),
  );
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [resettingLine, setResettingLine] = useState<string | null>(null);
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

  async function saveLinePoint(productLine: string) {
    const lineKey = normalizeInventoryText(productLine);
    const reorderPoint = Number(lineDrafts[lineKey] ?? threshold);
    if (
      !Number.isInteger(reorderPoint) ||
      reorderPoint < 0 ||
      reorderPoint > 999999
    ) {
      toast.error("Indica un punto entre 0 y 999.999 unidades.");
      return;
    }

    setSavingLine(lineKey);
    try {
      if (!isDemo) {
        const response = await fetch("/api/reorder-line-settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productLine, reorderPoint }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      setCustomLines((currentLines) => new Set(currentLines).add(lineKey));
      setLineDrafts((currentDrafts) => ({
        ...currentDrafts,
        [lineKey]: String(reorderPoint),
      }));
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      toast.success(`Punto de ${productLine} guardado`, {
        description: `Avisar al llegar a ${number.format(reorderPoint)} unidades o menos.`,
      });
    } catch (error) {
      toast.error("No pudimos guardar el punto de la línea", {
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSavingLine(null);
    }
  }

  async function resetLinePoint(productLine: string) {
    const lineKey = normalizeInventoryText(productLine);
    setResettingLine(lineKey);
    try {
      if (!isDemo) {
        const response = await fetch(
          `/api/reorder-line-settings?productLine=${encodeURIComponent(productLine)}`,
          { method: "DELETE" },
        );
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      setCustomLines((currentLines) => {
        const nextLines = new Set(currentLines);
        nextLines.delete(lineKey);
        return nextLines;
      });
      setLineDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[lineKey];
        return nextDrafts;
      });
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
      toast.success(`${productLine} usa nuevamente el umbral general`, {
        description: `${number.format(threshold)} unidades o menos.`,
      });
    } catch (error) {
      toast.error("No pudimos restablecer el punto", {
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setResettingLine(null);
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
      <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] xl:items-start">
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
              Es el valor general del portal. Las líneas personalizadas
              conservan su propio punto y cada cambio queda auditado.
            </AlertDescription>
          </Alert>
          <Button className="w-fit" disabled={!isAdmin || saving} onClick={save}>
            <Save /> {saving ? "Guardando…" : "Guardar regla"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <BellRing className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="font-display text-2xl uppercase">
                Punto de recompra por línea
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Personaliza el punto de cada línea principal. Por ejemplo, XTZ
                puede avisar con una cantidad distinta a Boxer.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {PRIORITY_PRODUCT_LINES.map((productLine, lineIndex) => {
              const lineKey = normalizeInventoryText(productLine);
              const inputId = `line-point-${lineIndex}`;
              const helpId = `line-help-${lineIndex}`;
              const draft = lineDrafts[lineKey] ?? String(threshold);
              const parsedPoint = Number(draft);
              const isValid =
                draft.trim() !== "" &&
                Number.isInteger(parsedPoint) &&
                parsedPoint >= 0 &&
                parsedPoint <= 999999;
              const isCustom = customLines.has(lineKey);
              const isSaving = savingLine === lineKey;
              const isResetting = resettingLine === lineKey;

              return (
                <div
                  key={productLine}
                  className="rounded-2xl border bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={inputId} className="font-semibold">
                      {productLine}
                    </Label>
                    <Badge variant={isCustom ? "default" : "outline"}>
                      {isCustom ? "Personalizado" : "Umbral general"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <Input
                        id={inputId}
                        type="number"
                        min={0}
                        max={999999}
                        step={1}
                        value={draft}
                        disabled={!isAdmin || isSaving || isResetting}
                        aria-invalid={!isValid}
                        aria-describedby={helpId}
                        onChange={(event) =>
                          setLineDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [lineKey]: event.target.value,
                          }))
                        }
                      />
                      <p
                        id={helpId}
                        className={
                          isValid
                            ? "mt-1.5 text-xs text-muted-foreground"
                            : "mt-1.5 text-xs text-destructive"
                        }
                      >
                        {isValid
                          ? `Avisar con ${number.format(parsedPoint)} unidades o menos.`
                          : "Ingresa un número entero entre 0 y 999.999."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!isAdmin || !isValid || isSaving || isResetting}
                      onClick={() => void saveLinePoint(productLine)}
                    >
                      {isSaving ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Save aria-hidden="true" />
                      )}
                      Guardar
                    </Button>
                  </div>
                  {isCustom ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      disabled={!isAdmin || isSaving || isResetting}
                      onClick={() => void resetLinePoint(productLine)}
                    >
                      {isResetting ? (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      ) : (
                        <RotateCcw aria-hidden="true" />
                      )}
                      Usar umbral general
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Alert className="mt-5">
            <ShieldCheck />
            <AlertTitle>Una regla independiente por línea</AlertTitle>
            <AlertDescription>
              Los cambios se guardan individualmente y se reflejan en Líneas
              principales, la campana y las alertas de recompra.
            </AlertDescription>
          </Alert>
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
                Últimos intentos de envío de alertas de recompra mediante Brevo.
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
                El próximo correo de recompra mostrará aquí si Brevo lo aceptó o
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
