"use client";

import {
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import { InventoryUploadProgress } from "@/components/inventory-upload-progress";
import { parseInventoryFile } from "@/lib/inventory/parser";
import {
  getBogotaCalendarDate,
  inventorySourceDateToIso,
} from "@/lib/inventory/source-date";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types/inventory";

type Preview = {
  file: File;
  items: InventoryItem[];
  checksum: string;
  sourceExportedAt: string;
};

const subscribeToHydration = () => () => undefined;

export function InventoryUpload({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const profile = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [uploadState, setUploadState] = useState<"processing" | "success">(
    "processing",
  );
  const [sourceDate, setSourceDate] = useState(() =>
    getBogotaCalendarDate(),
  );
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const allowed = profile.role === "admin" || profile.role === "uploader";

  async function recordFailure(
    filename: string,
    errorMessage: string,
    errorCode = "validation_error",
  ) {
    if (isDemo || !allowed) return;
    try {
      const response = await fetch("/api/inventory/import-failure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename,
          sourceExportedAt: inventorySourceDateToIso(sourceDate),
          errorCode,
          errorMessage,
        }),
      });
      if (response.ok) router.refresh();
    } catch {
      // El error visible para el usuario tiene prioridad sobre la telemetría.
    }
  }

  async function inspectFile(file?: File) {
    if (!file) return;
    setSelectedFileName(file.name);
    setBusy(true);
    setError("");
    setPreview(null);
    setProgress(30);
    try {
      const sourceExportedAt = inventorySourceDateToIso(sourceDate);
      const parsed = await parseInventoryFile(file, sourceExportedAt);
      setProgress(100);
      setPreview({ file, ...parsed, sourceExportedAt });
      toast.success("Archivo validado", {
        description: `${parsed.items.length} filas listas para publicar.`,
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "No pudimos leer el archivo.";
      setError(message);
      setProgress(0);
      await recordFailure(file.name, message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!preview || !allowed) return;
    setBusy(true);
    setProgress(55);
    setUploadState("processing");
    setShowUploadProgress(true);
    let reorderCount = 0;
    let emailRecipient: string | undefined;
    let emailWarning: string | undefined;
    let emailLogWarning: string | undefined;
    let reorderWarning: string | undefined;
    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 850));
      } else {
        const response = await fetch("/api/inventory/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: preview.file.name,
            checksum: preview.checksum,
            sourceExportedAt: preview.sourceExportedAt,
            items: preview.items,
          }),
        });
        const payload = (await response.json()) as {
          message?: string;
          reorderCount?: number;
          emailRecipient?: string;
          emailWarning?: string;
          emailLogWarning?: string;
          reorderWarning?: string;
        };
        if (!response.ok) throw new Error(payload.message ?? "Carga rechazada.");
        reorderCount = payload.reorderCount ?? 0;
        emailRecipient = payload.emailRecipient;
        emailWarning = payload.emailWarning;
        emailLogWarning = payload.emailLogWarning;
        reorderWarning = payload.reorderWarning;
      }
      setProgress(100);
      setUploadState("success");
      toast.success("Carga lista", {
        description: isDemo
          ? "Simulación completada. Conecta InsForge para persistirla."
          : reorderWarning
            ? "El inventario vigente quedó actualizado."
            : reorderCount > 0
              ? `El inventario quedó actualizado y detectamos ${reorderCount} ${reorderCount === 1 ? "producto" : "productos"} para recompra.`
              : "El inventario vigente quedó actualizado sin alertas nuevas de recompra.",
      });
      if (reorderCount > 0 && emailRecipient && !emailWarning) {
        toast.success("Correo enviado correctamente", {
          description: `La alerta de recompra se envió a ${emailRecipient}.`,
        });
      }
      if (emailWarning) {
        toast.error("Falló al enviar el correo", {
          description:
            "El inventario quedó guardado y las alertas se calcularon. Revisa el detalle en Ajustes.",
        });
      } else if (reorderWarning || emailLogWarning) {
        toast.warning("Inventario publicado con un aviso", {
          description: reorderWarning
            ? "La carga quedó guardada, pero no pudimos calcular las alertas de recompra. Puedes revisarlas desde Punto de Reorden."
            : "El correo se procesó, pero no pudimos guardar su registro en Ajustes.",
        });
      }
      setPreview(null);
      setSelectedFileName("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (caught) {
      setShowUploadProgress(false);
      setProgress(0);
      const message =
        caught instanceof Error
          ? caught.message
          : "El inventario vigente se mantuvo sin cambios.";
      await recordFailure(preview.file.name, message, "publication_error");
      toast.error("La carga no fue publicada", {
        description: message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <InventoryUploadProgress
        open={showUploadProgress}
        state={uploadState}
        onOpenChange={setShowUploadProgress}
      />
      <PageHeader
        eyebrow="Actualización manual controlada"
        title="Cargar inventario"
        description="Valida un Excel o CSV completo antes de sustituir el inventario vigente."
        icon={UploadCloud}
      />

      {!allowed && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Permiso de carga requerido</AlertTitle>
          <AlertDescription>
            Tu cuenta puede consultar datos, pero no publicar inventario.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl uppercase">
              Selecciona la fotografía completa
            </CardTitle>
            <CardDescription>
              CSV, XLSX o XLS de máximo 10 MB. Una carga inválida nunca reemplaza
              la última carga correcta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="inventory-file">Archivo de Effi</Label>
                <Input
                  ref={inputRef}
                  id="inventory-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="sr-only !h-px !w-px !border-0 !p-0"
                  disabled={!hydrated || !allowed || busy}
                  onChange={(event) => inspectFile(event.target.files?.[0])}
                />
                <div
                  className={cn(
                    "flex min-h-52 flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed bg-muted/25 p-5 text-center transition-colors",
                    dragging && "border-primary bg-primary/10",
                    (!allowed || busy) && "opacity-60",
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (allowed && !busy) setDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setDragging(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (!hydrated || !allowed || busy) return;
                    void inspectFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <div className="flex min-w-0 flex-col items-center gap-3">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <FileSpreadsheet className="size-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {selectedFileName || "Excel o CSV del inventario"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {selectedFileName
                          ? "Archivo seleccionado. El sistema lo validará antes de publicar."
                          : "Arrastra el archivo aquí o selecciónalo desde tu equipo."}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-11 w-full max-w-xs shrink-0"
                    disabled={!hydrated || !allowed || busy}
                    onClick={() => inputRef.current?.click()}
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <UploadCloud />
                    )}
                    {busy ? "Analizando…" : "Seleccionar Excel o CSV"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="source-date">Fecha del inventario</Label>
                <Input
                  id="source-date"
                  type="date"
                  max={getBogotaCalendarDate()}
                  value={sourceDate}
                  disabled={!hydrated || !allowed || busy}
                  onChange={(event) => {
                    setSourceDate(event.target.value);
                    setPreview(null);
                    setSelectedFileName("");
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                />
              </div>
            </div>

            {(busy || progress > 0) && <Progress value={progress} />}

            {error && (
              <Alert variant="destructive">
                <XCircle />
                <AlertTitle>Revisa las columnas del archivo</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {preview && (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <FileSpreadsheet />
                    </div>
                    <div>
                      <p className="font-semibold">{preview.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {preview.items.length} referencias listas
                      </p>
                    </div>
                  </div>
                  <Badge className="w-fit gap-1">
                    <CheckCircle2 /> Validación correcta
                  </Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Filas", preview.items.length],
                    [
                      "Líneas",
                      new Set(preview.items.map((item) => item.productLine)).size,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-background p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <Button className="mt-5 w-full sm:w-auto" onClick={publish} disabled={busy}>
                  {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
                  {busy ? "Publicando…" : "Publicar inventario"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-secondary text-secondary-foreground">
          <CardHeader>
            <CardTitle className="font-display text-2xl uppercase">
              Validaciones activas
            </CardTitle>
            <CardDescription className="text-secondary-foreground/65">
              El sistema detiene la publicación si encuentra:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              {[
                "Archivo vacío o formato no admitido.",
                "SKU, producto o línea faltante.",
                "SKU duplicado dentro del archivo.",
                "Cantidades que no sean numéricas.",
                "Fecha futura o archivo demasiado grande.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
