"use client";

import {
  Download,
  FileImage,
  FileText,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventoryData } from "@/components/providers/inventory-provider";
import type { InventoryItem, ProductAttachment } from "@/types/inventory";

type DbAttachment = {
  id: string;
  sku: string;
  file_name: string;
  file_url: string;
  file_key: string;
  mime_type: ProductAttachment["mimeType"];
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

const fileSize = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});

function mapAttachment(row: DbAttachment): ProductAttachment {
  return {
    id: row.id,
    sku: row.sku,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileKey: row.file_key,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export function ProductDocumentsDialog({
  item,
  open,
  onOpenChange,
}: {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isDemo } = useInventoryData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ProductAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadAttachments = useCallback(async () => {
    if (!item || !open || isDemo) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/attachments?sku=${encodeURIComponent(item.sku)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        data?: DbAttachment[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message);
      setAttachments((payload.data ?? []).map(mapAttachment));
    } catch (error) {
      toast.error("No pudimos consultar los documentos", {
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }, [isDemo, item, open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAttachments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAttachments]);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file || !item) {
      toast.error("Selecciona un PDF o una imagen.");
      return;
    }

    setUploading(true);
    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 650));
      } else {
        const formData = new FormData();
        formData.set("sku", item.sku);
        formData.set("file", file);
        const response = await fetch("/api/attachments", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message);
      }
      if (inputRef.current) inputRef.current.value = "";
      await loadAttachments();
      toast.success("Documento adjuntado", {
        description: `${file.name} quedó asociado a ${item.sku}.`,
      });
    } catch (error) {
      toast.error("No pudimos adjuntar el documento", {
        description:
          error instanceof Error
            ? error.message
            : "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(attachment: ProductAttachment) {
    setDeletingId(attachment.id);
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
      toast.success("Documento eliminado");
    } catch (error) {
      toast.error("No pudimos eliminar el documento", {
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setAttachments([]);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            Documentos del producto
          </DialogTitle>
          <DialogDescription>
            {item
              ? `${item.sku} · ${item.productName}`
              : "Selecciona un producto"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl border bg-muted/30">
            {loading ? (
              <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Consultando documentos…
              </div>
            ) : attachments.length > 0 ? (
              <ul className="divide-y">
                {attachments.map((attachment) => {
                  const isImage = attachment.mimeType.startsWith("image/");
                  return (
                    <li
                      key={attachment.id}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                        {isImage ? (
                          <FileImage className="size-5" />
                        ) : (
                          <FileText className="size-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {attachment.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fileSize.format(attachment.sizeBytes / 1024)} KB
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="icon">
                        <a
                          href={`/api/attachments/${attachment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ${attachment.fileName}`}
                        >
                          <Download />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === attachment.id}
                        onClick={() => deleteAttachment(attachment)}
                        aria-label={`Eliminar ${attachment.fileName}`}
                      >
                        {deletingId === attachment.id ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex min-h-28 flex-col items-center justify-center p-4 text-center">
                <FileText className="size-6 text-primary" />
                <p className="mt-2 text-sm font-semibold">
                  Sin documentos adjuntos
                </p>
                <p className="text-xs text-muted-foreground">
                  Puedes añadir una ficha técnica o una imagen.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="attachment">Añadir documento interno</Label>
            <Input
              ref={inputRef}
              id="attachment"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
            />
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG o WebP. Máximo 15 MB.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !item}>
            {uploading ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            {uploading ? "Adjuntando…" : "Adjuntar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
