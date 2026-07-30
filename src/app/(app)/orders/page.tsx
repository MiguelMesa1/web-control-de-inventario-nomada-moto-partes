import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Gestión de compras"
        title="Pedidos"
        description="Consulta y administra los pedidos de inventario."
        icon={ClipboardList}
      />
      <Card className="grid min-h-72 place-items-center">
        <CardContent className="pt-6 text-center">
          <ClipboardList className="mx-auto size-12 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-display text-3xl font-bold uppercase">Próximamente...</h2>
        </CardContent>
      </Card>
    </div>
  );
}
