import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5" aria-label="Cargando información">
      <div className="flex min-h-[72px] items-end justify-between gap-4 border-b pb-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-[38px] w-40 rounded-[9px]" />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-[14px]" />
        ))}
      </div>
      <TableSkeleton rows={6} columns={3} />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
