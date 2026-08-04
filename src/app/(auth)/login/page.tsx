import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isInsForgeConfigured } from "@/lib/insforge/config";

export default function LoginPage() {
  const configured = isInsForgeConfigured();
  return (
    <main className="racing-grid min-h-dvh bg-background p-4 text-foreground sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl xl:grid-cols-[1.08fr_0.92fr]">
        <section className="racing-stripe relative flex min-h-[30rem] flex-col justify-between overflow-hidden border-b border-border bg-secondary p-6 text-secondary-foreground sm:p-10 xl:min-h-[34rem] xl:border-b-0 xl:border-r xl:p-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl" />
          <BrandMark
            transparent
            className="h-20 max-w-[19rem] sm:h-24 sm:max-w-[23rem]"
          />
          <div className="relative max-w-2xl py-16">
            <Badge className="mb-5 uppercase tracking-[0.16em]">
              Uso interno
            </Badge>
            <h1 className="font-display text-4xl font-bold uppercase leading-[0.92] tracking-wide sm:text-6xl">
              Control de
              <span className="block text-primary">inventario.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-secondary-foreground/80 sm:text-lg">
              Consulta existencias, revisa cambios y carga actualizaciones.
            </p>
          </div>
          <div className="relative flex items-center gap-3 text-sm text-secondary-foreground/80">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            Acceso restringido a personal autorizado.
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-card p-5 text-card-foreground sm:p-10 xl:px-12">
          <ThemeToggle className="absolute right-5 top-5 sm:right-8 sm:top-8" />
          <Card className="w-full max-w-lg border-border/80 bg-background/70 shadow-xl dark:border-white/10 dark:bg-white/[0.035]">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Acceso
              </p>
              <h2 className="font-display text-3xl font-bold uppercase">
                Inventario Nómada
              </h2>
              <p className="text-sm leading-relaxed text-foreground/75">
                Ingresa con tu correo para consultar y actualizar existencias.
              </p>
            </CardHeader>
            <CardContent>
              {configured ? (
                <LoginForm />
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Modo demostración activo.
                  </p>
                  <Button asChild size="lg">
                    <Link href="/dashboard">Abrir demostración</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
