import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Cargando información">
      <div className="racing-stripe rounded-3xl border bg-card p-6 sm:p-7">
        <div className="space-y-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
