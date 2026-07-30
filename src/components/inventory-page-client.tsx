"use client";

import { Download, PackageSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { InventoryTable } from "@/components/inventory-table";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { Button } from "@/components/ui/button";

export function InventoryPageClient() {
  const data = useInventoryData();
  const searchParams = useSearchParams();
  const initialLine = searchParams.get("line") ?? "all";
  const initialQuery = searchParams.get("sku") ?? "";

  function exportInventory() {
    const columns = [
      "SKU",
      "Producto",
      "Línea",
      "Existencia",
      "Reservado",
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
        item.reserved,
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
    <>
      <PageHeader
        eyebrow="Consulta central"
        title="Inventario"
        description="Busca rápido por SKU o producto y filtra por línea o disponibilidad."
        icon={PackageSearch}
        action={
          <Button
            variant="outline"
            onClick={exportInventory}
            disabled={data.current.length === 0}
          >
            <Download data-icon="inline-start" />
            Exportar inventario
          </Button>
        }
      />
      <InventoryTable
        key={`${initialLine}:${initialQuery}`}
        items={data.current}
        lowStockThreshold={data.lowStockThreshold}
        initialLine={initialLine}
        initialQuery={initialQuery}
      />
    </>
  );
}
