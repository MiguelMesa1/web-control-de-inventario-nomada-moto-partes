"use client";

import Image from "next/image";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InventoryUploadProgressProps = {
  open: boolean;
  state: "processing" | "success";
  onOpenChange: (open: boolean) => void;
};

export function InventoryUploadProgress({
  open,
  state,
  onOpenChange,
}: InventoryUploadProgressProps) {
  const processing = state === "processing";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (processing && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className={`overflow-hidden border-primary/40 p-0 sm:max-w-lg ${processing ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (processing) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (processing) event.preventDefault();
        }}
      >
        <div className="relative bg-secondary px-5 pb-6 pt-5 text-secondary-foreground sm:px-7">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-2xl uppercase text-primary sm:text-3xl">
              {processing ? "Procesando tu documento" : "Documento procesado"}
            </DialogTitle>
            <DialogDescription className="text-secondary-foreground/75">
              {processing
                ? "Estamos validando la información y actualizando el inventario. Este proceso puede tardar unos segundos."
                : "El inventario se actualizó correctamente y ya está disponible."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="mammoth-processing-stage mt-6"
            data-processing-state={state}
            aria-hidden="true"
          >
            <div className="mammoth-processing-lines">
              <span />
              <span />
              <span />
            </div>
            <div className="mammoth-processing-runner">
              <Image
                src="/brand/nomada-mammoth-running-2d.webp"
                alt=""
                width={1254}
                height={1254}
                sizes="(max-width: 640px) 144px, 176px"
                className="h-auto w-full"
                unoptimized
              />
            </div>
            <div className="mammoth-processing-success">
              <CheckCircle2 className="size-7" strokeWidth={2.6} />
            </div>
          </div>

          <div
            className="mt-5 flex min-h-6 items-center gap-2 text-sm font-semibold"
            role="status"
            aria-live="polite"
            aria-busy={processing}
          >
            {processing ? (
              <LoaderCircle
                className="size-5 shrink-0 animate-spin text-primary"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
            {processing
              ? "Leyendo y comprobando la información…"
              : "Inventario actualizado correctamente"}
          </div>
        </div>

        {!processing && (
          <div className="flex justify-end bg-background px-5 py-4 sm:px-7">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Continuar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
