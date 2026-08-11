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
    <main className="racing-grid min-h-dvh bg-background text-foreground sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-dvh max-w-7xl overflow-hidden bg-card shadow-2xl sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:border sm:border-border lg:min-h-[calc(100dvh-5rem)] xl:grid-cols-[1.08fr_0.92fr]">
        <section className="racing-stripe relative flex min-h-0 flex-col gap-3 overflow-hidden border-b border-border bg-secondary px-5 py-4 text-secondary-foreground sm:min-h-[28rem] sm:justify-between sm:gap-6 sm:p-10 xl:min-h-[34rem] xl:border-b-0 xl:border-r xl:p-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl" />
          <BrandMark
            transparent
            className="relative mx-auto h-12 max-w-[12rem] rounded-lg shadow-[0_0_22px_rgba(240,227,0,0.12)] sm:mx-0 sm:h-24 sm:max-w-[23rem] sm:rounded-xl"
          />
          <div className="relative max-w-2xl sm:py-10 xl:py-16">
            <Badge className="mb-3 uppercase tracking-[0.16em] sm:mb-5">
              Uso interno
            </Badge>
            <h1 className="font-display text-3xl font-bold uppercase leading-[0.92] tracking-wide sm:text-6xl">
              Control de
              <span className="block text-primary">inventario.</span>
            </h1>
            <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-secondary-foreground/80 min-[400px]:block sm:mt-6 sm:text-lg">
              Consulta existencias, revisa cambios y carga actualizaciones.
            </p>
          </div>
          <div className="relative flex min-h-9 items-center gap-3 text-xs text-secondary-foreground/80 sm:min-h-11 sm:text-sm">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            Acceso restringido a personal autorizado.
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-card px-4 pb-6 pt-16 text-card-foreground sm:p-10 xl:px-12">
          <ThemeToggle className="absolute right-4 top-4 border border-border bg-background/85 shadow-sm sm:right-8 sm:top-8" />
          <Card className="w-full max-w-lg border-0 bg-transparent shadow-none sm:border sm:border-border/80 sm:bg-background/70 sm:shadow-xl sm:dark:border-white/10 sm:dark:bg-white/[0.035]">
            <CardHeader className="px-1 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Acceso
              </p>
              <h2 className="font-display text-2xl font-bold uppercase sm:text-3xl">
                Inventario Nómada
              </h2>
              <p className="text-sm leading-relaxed text-foreground/75">
                Ingresa con tu correo para consultar y actualizar existencias.
              </p>
            </CardHeader>
            <CardContent className="px-1 sm:px-6">
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
