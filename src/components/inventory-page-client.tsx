"use client";

import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

  function exportInventory() {
    const columns = [
      "SKU",
      "Producto",
      "Línea",
      "Existencia",
      "Disponible",
      "Fecha",
    ];
    const safeCell = (value: string | number) => {
      const text = String(value);
      const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${protectedText.replaceAll('"', '""')}"`;
    };
    const rows = data.current.map((item) =>
      [
        item.sku,
        item.productName,
        item.productLine,
        item.stock,
        item.available,
        item.sourceExportedAt.slice(0, 10),
      ]
        .map(safeCell)
        .join(","),
    );
    const blob = new Blob(
      [`\uFEFF${columns.map(safeCell).join(",")}\r\n${rows.join("\r\n")}`],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inventario-nomada-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
              disabled={data.current.length === 0}
            >
              <Download data-icon="inline-start" />
              Exportar
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
