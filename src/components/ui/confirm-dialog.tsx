"use client";

import type { LucideIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Patrón transversal D · Modales (README §"13 · Patrones transversales").
 * Modal centrado para decisiones cortas: icono de 38px a la izquierda con
 * fondo de estado, título 15.5px, cuerpo 13px, pie en --table-header
 * (#FAFAF9) con border-top. El foco inicial va en "Cancelar", nunca en el
 * botón destructivo. `confirmLabel` debe nombrar la consecuencia
 * ("Revertir carga"), nunca un genérico "Aceptar".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  tone = "neutral",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  confirming = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: LucideIcon;
  tone?: "neutral" | "destructive";
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-[440px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <div className="flex items-start gap-3.5 p-5">
          {Icon && (
            <div
              className={cn(
                "grid size-[38px] shrink-0 place-items-center rounded-xl",
                tone === "destructive"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
            </div>
          )}
          <DialogHeader className="gap-1.5 text-left">
            <DialogTitle className="text-[15.5px] font-bold leading-snug">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex justify-end gap-2 border-t bg-table-header px-5 py-3.5">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
