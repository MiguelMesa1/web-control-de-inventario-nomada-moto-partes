import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <header className="racing-stripe relative mb-7 overflow-hidden rounded-3xl border border-border/80 bg-card/95 px-5 py-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_14px_36px_hsl(var(--foreground)/0.035)] sm:px-7 sm:py-7">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
      <div className="absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-3xl items-start gap-4">
          {Icon && (
            <div className="hidden size-12 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-secondary text-primary shadow-sm sm:grid">
              <Icon className="size-5" aria-hidden="true" />
            </div>
          )}
          <div>
            <Badge
              variant="outline"
              className="mb-3 gap-2 border-primary/35 bg-primary/10 uppercase tracking-[0.14em]"
            >
              {Icon && <Icon className="sm:hidden" aria-hidden="true" />}
              {eyebrow}
            </Badge>
            <h1 className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-wide sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
        </div>
        {action && (
          <div className="w-full shrink-0 [&>*]:w-full md:w-auto md:[&>*]:w-auto">
            {action}
          </div>
        )}
      </div>
    </header>
  );
}
