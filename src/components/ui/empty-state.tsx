import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const toneClasses = {
  /** Filtro sin resultados: icono `search-x` sobre fondo neutro. */
  neutral: "bg-row-separator text-muted-foreground",
  /** Sección sin datos aún: icono `clipboard-list` sobre amarillo tenue. */
  brand: "bg-primary/20 text-foreground",
  /** Error de conexión: icono `cloud-off` sobre rojo suave. */
  "soft-destructive": "bg-destructive/10 text-destructive",
} as const;

/**
 * Patrón transversal A · Estados vacíos (README §"13 · Patrones transversales").
 *
 * Tres causas piden tres respuestas — filtro sin resultados, sección sin
 * datos, error de conexión — y el botón es siempre la salida. El vacío por
 * filtro debe nombrar el filtro aplicado en `description`
 * ("No hay referencias NKD agotadas en la carga del 24 ago"), nunca decir
 * "Sin resultados" a secas.
 */
export function EmptyState({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof toneClasses;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl",
          toneClasses[tone],
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-bold text-foreground">{title}</p>
        {description && (
          <p className="max-w-[34ch] text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
