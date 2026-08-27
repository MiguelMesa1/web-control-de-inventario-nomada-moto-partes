"use client";

import {
  CheckCircle2,
  Clock3,
  MailWarning,
  KeyRound,
  Minus,
  Plus,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { PasswordResetDialog } from "@/components/password-reset-dialog";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { cn } from "@/lib/utils";
import type { EmailDeliveryAttempt } from "@/types/inventory";

const emailDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

const sections = [
  { id: "umbrales", label: "Umbrales", adminOnly: true },
  { id: "seguridad", label: "Seguridad", adminOnly: false },
  { id: "cargas", label: "Cargas", adminOnly: true },
] as const;

export function SettingsPanel({
  initialLowStockThreshold,
  initialEmailAttempts,
  inventoryAvailability,
  isDemo,
}: {
  initialLowStockThreshold: number;
  initialEmailAttempts: EmailDeliveryAttempt[];
  inventoryAvailability: number[];
  isDemo: boolean;
}) {
  const profile = useProfile();
  const [threshold, setThreshold] = useState(initialLowStockThreshold);
  const [savedThreshold, setSavedThreshold] = useState(initialLowStockThreshold);
  const [saving, setSaving] = useState(false);
  const isAdmin = profile.role === "admin";
  const visibleSections = sections.filter(
    (section) => !section.adminOnly || isAdmin,
  );
  const [activeSection, setActiveSection] = useState(
    isAdmin ? "umbrales" : "seguridad",
  );
  const dirty = threshold !== savedThreshold;
  const lowStockConsequence = inventoryAvailability.filter(
    (available) => available > 0 && available <= threshold,
  ).length;

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
      setSavedThreshold(threshold);
    } catch (error) {
      toast.error("No pudimos guardar", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", dirty && "pb-16")}>
      <PageHeader
        title="Configuración"
        subtitle={
          isAdmin
            ? `Umbral bajo: ${threshold} unidades · ${initialEmailAttempts.length} intentos de correo registrados`
            : profile.email
        }
      />

      <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <Select value={activeSection} onValueChange={setActiveSection}>
          <SelectTrigger className="lg:hidden" aria-label="Sección de configuración">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {visibleSections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <nav
          aria-label="Secciones de configuración"
          className="hidden flex-col gap-0.5 lg:flex"
        >
          {visibleSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "relative flex h-10 items-center rounded-[10px] px-3 text-left text-[13.5px] font-medium text-foreground-secondary transition-colors hover:bg-muted/60 hover:text-foreground",
                  activeSection === section.id &&
                    "bg-primary/[0.16] font-bold text-foreground",
                )}
              >
                {activeSection === section.id && (
                  <span className="absolute inset-y-[9px] left-0 w-[3px] rounded-full bg-primary" />
                )}
                {section.label}
              </button>
            ))}
        </nav>

        <div className="flex flex-col gap-6">
          {activeSection === "seguridad" && (
          <section id="seguridad">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-xl uppercase">
                  <KeyRound className="size-5 text-primary" /> Seguridad de la cuenta
                </CardTitle>
                <CardDescription>
                  Cambia tu contraseña mediante un código enviado a {profile.email}.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Al terminar se cerrará tu sesión y deberás entrar nuevamente con la
                  contraseña nueva.
                </p>
                <PasswordResetDialog disabled={isDemo} />
                {isDemo && (
                  <p className="text-xs text-muted-foreground">
                    El cambio de contraseña no está disponible en modo demostración.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
          )}

          {isAdmin && (
            <>
              {activeSection === "umbrales" && (
              <section id="umbrales">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle className="font-display text-xl uppercase">
                      Umbral de inventario bajo
                    </CardTitle>
                    <CardDescription>
                      Se considera bajo cuando el disponible es mayor que cero y
                      menor o igual al umbral.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="threshold">Unidades disponibles</Label>
                      <div className="flex h-10 w-fit items-stretch overflow-hidden rounded-[9px] border border-input">
                        <button
                          type="button"
                          className="grid w-7 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                          disabled={!isAdmin || threshold <= 0}
                          onClick={() => setThreshold((value) => Math.max(0, value - 1))}
                          aria-label="Bajar umbral"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          id="threshold"
                          type="number"
                          min={0}
                          max={9999}
                          value={threshold}
                          disabled={!isAdmin}
                          onChange={(event) =>
                            setThreshold(Math.max(0, Number(event.target.value) || 0))
                          }
                          className="w-16 border-x border-input bg-background text-center text-sm font-bold tabular-nums outline-none disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          className="grid w-7 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                          disabled={!isAdmin || threshold >= 9999}
                          onClick={() => setThreshold((value) => Math.min(9999, value + 1))}
                          aria-label="Subir umbral"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Con {threshold} →{" "}
                        <strong className="text-foreground">
                          {number.format(lowStockConsequence)} referencias
                        </strong>{" "}
                        quedarían en estado bajo. También se usa para la cantidad
                        sugerida en Recompra.
                      </p>
                    </div>
                    <Alert>
                      <ShieldCheck />
                      <AlertTitle>Cambio auditable</AlertTitle>
                      <AlertDescription>
                        Este valor sirve para las vistas generales del inventario. Las
                        alertas de recompra usan el mínimo configurado en cada producto.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </section>
              )}

              {activeSection === "cargas" && (
              <section id="cargas">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="font-display text-xl uppercase">
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
                  <CardContent className="p-0">
                    {initialEmailAttempts.length === 0 ? (
                      <EmptyState
                        icon={MailWarning}
                        tone="brand"
                        title="Aún no hay intentos registrados"
                        description="El próximo correo de reposición mostrará aquí si Brevo lo aceptó o qué error impidió enviarlo."
                      />
                    ) : (
                      <div className="overflow-x-auto px-2 pb-2">
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
              )}
            </>
          )}
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur lg:left-[264px] lg:px-8">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            1 cambio sin guardar
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setThreshold(savedThreshold)}>
              Descartar
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
