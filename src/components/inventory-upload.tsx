"use client";

import {
  Check,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { parseInventoryInWorker } from "@/lib/inventory/parse-in-worker";
import { serializeInventoryImport } from "@/lib/inventory/import-payload";
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

const steps = [
  { id: 1, label: "Archivo" },
  { id: 2, label: "Validación" },
  { id: 3, label: "Aplicar" },
];

function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex items-center" aria-label="Progreso de la carga">
      {steps.map((step, index) => {
        const state =
          step.id < current ? "done" : step.id === current ? "current" : "pending";
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  state === "done" && "bg-foreground text-primary",
                  state === "current" && "border-2 border-foreground bg-primary text-primary-foreground",
                  state === "pending" && "border border-border text-muted-foreground",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {state === "done" ? <Check className="size-3" /> : step.id}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  state === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.id} · {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  "mx-3 h-0.5 flex-1 rounded-full",
                  step.id < current ? "bg-foreground" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function InventoryUpload({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const profile = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const parseController = useRef<AbortController | null>(null);
  useEffect(() => () => parseController.current?.abort(), []);
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
  const currentStep = showUploadProgress ? 3 : preview ? 2 : 1;

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
      parseController.current?.abort();
      const controller = new AbortController();
      parseController.current = controller;
      const parsed = await parseInventoryInWorker(file, sourceExportedAt, controller.signal);
      setProgress(100);
      setPreview({ file, ...parsed, sourceExportedAt });
      toast.success("Archivo validado", {
        description: `${parsed.items.length} filas listas para publicar.`,
      });
    } catch (caught) {
      if (parseController.current?.signal.aborted) return;
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
    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 850));
      } else {
        const response = await fetch("/api/inventory/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: serializeInventoryImport(preview.file.name, preview.checksum, preview.sourceExportedAt, preview.items),
        });
        const payload = (await response.json()) as {
          message?: string;
        };
        if (!response.ok) throw new Error(payload.message ?? "Carga rechazada.");
      }
      setProgress(100);
      setUploadState("success");
      toast.success("Carga lista", {
        description: isDemo
          ? "Simulación completada. Conecta InsForge para persistirla."
          : "El inventario quedó actualizado. Las alertas y el correo se procesan en segundo plano; puedes revisar el envío en Ajustes.",
      });
      setPreview(null);
      setSelectedFileName("");
      if (inputRef.current) inputRef.current.value = "";
      window.dispatchEvent(new Event("reorder-alerts:refresh"));
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
        title="Cargar inventario"
        subtitle={
          preview
            ? `${preview.items.length.toLocaleString("es-CO")} filas validadas · ${selectedFileName}`
            : "Sin archivo en validación"
        }
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

      <Card>
        <CardContent className="pt-5">
          <StepRail current={currentStep} />
        </CardContent>
      </Card>

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
                    "flex min-h-[132px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-muted/25 p-5 text-center transition-colors",
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
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <FileSpreadsheet className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-semibold">
                        {selectedFileName || "Excel o CSV del inventario"}
                      </p>
                      <p className="mt-0.5 max-w-sm text-xs text-muted-foreground">
                        {selectedFileName
                          ? "Archivo seleccionado. El sistema lo validará antes de publicar."
                          : "Arrastra el archivo aquí o selecciónalo desde tu equipo."}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
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
                    <div className="grid size-11 place-items-center rounded-xl bg-success/15 text-success">
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
                  {busy ? `Publicando…` : `Aplicar ${preview.items.length} filas`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-secondary text-secondary-foreground">
          <CardHeader>
            <CardTitle className="font-display text-xl uppercase">
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
            <p className="mt-5 border-t border-secondary-foreground/15 pt-4 text-xs text-secondary-foreground/65">
              Se guarda archivo, usuario y fecha por 90 días.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
