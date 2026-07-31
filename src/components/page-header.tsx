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
    <header className="mb-6 flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <Badge variant="outline" className="mb-3 gap-2 border-primary/35 bg-primary/10 uppercase tracking-wider">
          {Icon && <Icon aria-hidden="true" />}
          {eyebrow}
        </Badge>
        <h1 className="font-display text-3xl font-bold uppercase leading-[0.95] tracking-wide sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {action && <div className="w-full shrink-0 [&>*]:w-full md:w-auto md:[&>*]:w-auto">{action}</div>}
    </header>
  );
}
