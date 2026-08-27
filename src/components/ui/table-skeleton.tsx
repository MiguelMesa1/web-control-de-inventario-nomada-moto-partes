import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Patrón transversal B · Estados de carga (README §"13 · Patrones
 * transversales"). El esqueleto imita la forma real del contenido: mismas
 * alturas de fila (48px) y de encabezado (40px), y dos barras por celda de
 * producto (62% / 38% de ancho, imitando nombre + SKU). Las últimas dos
 * filas bajan a opacity .7 y .45. Nunca amarillo: el amarillo es acción,
 * no espera.
 */
export function TableSkeleton({
  rows = 6,
  columns = 3,
  className,
}: {
  /** Filas de contenido a simular, sin contar el encabezado. */
  rows?: number;
  /** Columnas numéricas adicionales a la derecha de la celda de producto. */
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl border", className)}
      role="status"
      aria-label="Cargando datos"
    >
      <div className="flex h-10 items-center gap-6 bg-table-header px-4">
        <Skeleton className="h-2.5 w-24 rounded-sm bg-muted" />
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton
            key={index}
            className="ml-auto h-2.5 w-12 shrink-0 rounded-sm bg-muted"
          />
        ))}
      </div>
      <div className="divide-y divide-row-separator">
        {Array.from({ length: rows }).map((_, rowIndex) => {
          const fromEnd = rows - 1 - rowIndex;
          const opacity =
            fromEnd === 0 ? "opacity-45" : fromEnd === 1 ? "opacity-70" : "";
          return (
            <div
              key={rowIndex}
              className={cn(
                "flex h-12 items-center gap-6 px-4 transition-opacity",
                opacity,
              )}
            >
              <div className="flex flex-1 flex-col justify-center gap-1.5">
                <Skeleton className="h-2.5 w-[62%] rounded-sm bg-muted" />
                <Skeleton className="h-2 w-[38%] rounded-sm bg-row-separator" />
              </div>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className="ml-auto h-2.5 w-12 shrink-0 rounded-sm bg-muted"
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
