"use client";

import Image from "next/image";
import { CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InventoryUploadCelebration({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-primary/40 p-0 sm:max-w-lg">
        <div className="relative bg-secondary px-5 pb-6 pt-5 text-secondary-foreground sm:px-7">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-2xl uppercase text-primary sm:text-3xl">
              ¡Carga completada!
            </DialogTitle>
            <DialogDescription className="text-secondary-foreground/75">
              El mamut llegó a la meta: tu inventario ya está actualizado.
            </DialogDescription>
          </DialogHeader>

          <div className="mammoth-race-track mt-6" aria-hidden="true">
            <div className="mammoth-race-finish">
              <Flag className="size-8" strokeWidth={2.5} />
            </div>
            <div className="mammoth-race-runner">
              <Image
                src="/brand/nomada-elephant.png"
                alt=""
                width={160}
                height={110}
                sizes="160px"
                className="h-auto w-32 sm:w-40"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
            Inventario publicado correctamente
          </div>
        </div>
        <div className="flex justify-end bg-background px-5 py-4 sm:px-7">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
