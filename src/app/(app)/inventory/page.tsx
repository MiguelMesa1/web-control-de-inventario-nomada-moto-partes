import { Suspense } from "react";
import { InventoryPageClient } from "@/components/inventory-page-client";
import { InventoryProvider } from "@/components/providers/inventory-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { loadInventoryPageData } from "@/lib/inventory/data";

export default async function InventoryPage() {
  const data = await loadInventoryPageData();
  return (
    <InventoryProvider value={data}>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <InventoryPageClient />
      </Suspense>
    </InventoryProvider>
  );
}
