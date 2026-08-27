/**
 * Encabezado de una línea (README §"Sistema de diseño del rediseño", regla 2
 * "Fuera el PageHeader decorativo"). Reemplaza la tarjeta rounded-3xl con
 * franjas diagonales, borde amarillo y eyebrow: ahora es título + subtítulo
 * con datos (no descripción) y hasta dos botones a la derecha, separados del
 * contenido por un borde inferior de 1px.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  /** Cifras/estado de la pantalla, p.ej. "2.418 referencias · carga del 24 ago, 8:15". No es una descripción de la pantalla. */
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b pb-4 lg:min-h-[72px] lg:flex-row lg:items-end lg:justify-between lg:gap-4">
      <div className="min-w-0">
        <h1 className="hidden font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.03em] lg:block">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] leading-relaxed text-muted-foreground lg:mt-2 lg:text-[13.5px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 [&>*]:flex-1 lg:w-auto lg:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </header>
  );
}
