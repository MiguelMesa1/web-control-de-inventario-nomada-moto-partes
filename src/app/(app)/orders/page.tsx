import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  PackageCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const plannedSteps = [
  {
    title: "Preparar solicitud",
    description: "Convertir productos por reponer en una solicitud organizada.",
    icon: ShoppingCart,
  },
  {
    title: "Dar seguimiento",
    description: "Registrar proveedor, cantidades y estado de cada pedido.",
    icon: Truck,
  },
  {
    title: "Confirmar recepción",
    description: "Cerrar el pedido cuando la mercancía llegue al inventario.",
    icon: PackageCheck,
  },
];

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Gestión de compras"
        title="Pedidos"
        description="El siguiente paso del flujo de recompra estará centralizado en este módulo."
        icon={ClipboardList}
        action={
          <Button asChild>
            <Link href="/reorder">
              Revisar recompra
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

      <Card className="racing-stripe overflow-hidden border-primary/30 bg-secondary text-secondary-foreground">
        <CardContent className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_0_6px_hsl(var(--primary)/0.1)]">
            <ClipboardCheck className="size-7" aria-hidden="true" />
          </div>
          <div>
            <Badge className="mb-3">Módulo en preparación</Badge>
            <h2 className="font-display text-2xl font-bold uppercase sm:text-3xl">
              Del punto de reorden al pedido recibido
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-foreground/70 sm:text-base">
              Mientras termino esta sección, puedes identificar las compras urgentes desde Punto de Reorden y consultar sus existencias en Inventario.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link href="/inventory">Abrir inventario</Link>
          </Button>
        </CardContent>
      </Card>

      <section aria-labelledby="orders-flow-title">
        <div className="mb-4 flex flex-col gap-1">
          <h2 id="orders-flow-title" className="font-display text-2xl font-bold uppercase">
            Flujo previsto
          </h2>
          <p className="text-sm text-muted-foreground">
            Una vista previa de cómo se organizará la gestión de compras.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plannedSteps.map((step, index) => (
            <Card key={step.title} className="relative overflow-hidden">
              <span className="absolute right-4 top-3 font-display text-5xl font-bold text-primary/10" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <CardHeader>
                <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-foreground">
                  <step.icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="pt-3 font-display text-xl uppercase">
                  {step.title}
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  {step.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
