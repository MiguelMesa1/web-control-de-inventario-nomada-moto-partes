"use client";

import { Download, LoaderCircle, Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { InventoryTable } from "@/components/inventory-table";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { Button } from "@/components/ui/button";

const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function InventoryPageClient() {
  const [exporting, setExporting] = useState(false);
  const data = useInventoryData();
  const profile = useProfile();
  const canUpload = profile.role === "admin" || profile.role === "uploader";
  const searchParams = useSearchParams();
  const initialLine = searchParams.get("line") ?? "all";
  const initialQuery = searchParams.get("sku") ?? "";
  const referenceCount = new Set(data.current.map((item) => item.sku)).size;
  const latestExportedAt = data.current.reduce<string | null>(
    (latest, item) =>
      !latest || item.sourceExportedAt > latest ? item.sourceExportedAt : latest,
    null,
  );

  async function exportInventory() {
    setExporting(true);
    try {
      const { downloadInventoryExcel } = await import(
        "@/lib/inventory/export-inventory"
      );
      downloadInventoryExcel(data.current);
      toast.success("Excel descargado", {
        description: "El inventario se exportó en formato .xlsx.",
      });
    } catch (error) {
      toast.error("No pudimos exportar el Excel", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Inventario"
        subtitle={
          <>
            {referenceCount.toLocaleString("es-CO")} referencias
            {latestExportedAt && (
              <> · carga del {dateTime.format(new Date(latestExportedAt))}</>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportInventory}
              disabled={data.current.length === 0 || exporting}
            >
              {exporting ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {exporting ? "Generando Excel" : "Exportar Excel"}
            </Button>
            {canUpload && (
              <Button asChild>
                <Link href="/uploads">
                  <Upload data-icon="inline-start" />
                  Cargar inventario
                </Link>
              </Button>
            )}
          </>
        }
      />
      <InventoryTable
        key={`${initialLine}:${initialQuery}`}
        items={data.current}
        lowStockThreshold={data.lowStockThreshold}
        initialLine={initialLine}
        initialQuery={initialQuery}
      />
    </div>
  );
}
