import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isInsForgeConfigured } from "@/lib/insforge/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const configured = isInsForgeConfigured();
  const passwordUpdated = (await searchParams).password === "updated";
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid min-h-dvh max-w-[1600px] xl:grid-cols-[1.1fr_0.9fr]">
        <section className="relative flex h-[250px] min-h-0 flex-none flex-col justify-between overflow-hidden bg-[#1A1A19] px-6 py-[26px] text-white xl:h-auto xl:min-h-full xl:px-14 xl:py-[52px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(240,227,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(240,227,0,0.03) 1px, transparent 1px)",
              backgroundSize: "34px 34px",
              maskImage: "linear-gradient(to bottom, #000, transparent 80%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000, transparent 80%)",
            }}
            aria-hidden="true"
          />
          <Image
            src="/brand/nomada-mammoth-running-2d.webp"
            alt=""
            width={840}
            height={560}
            loading="eager"
            className="pointer-events-none absolute -bottom-4 -right-[30px] w-[230px] opacity-[0.14] xl:-bottom-[30px] xl:-right-10 xl:w-[420px]"
            aria-hidden="true"
          />

          <BrandMark
            transparent
            className="relative h-10 max-w-[200px] rounded-none shadow-none xl:h-16 xl:max-w-[300px]"
          />

          <div className="relative xl:flex xl:flex-1 xl:flex-col xl:justify-center xl:pb-20">
            <Badge className="mb-3 w-fit border border-primary/40 bg-transparent px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary shadow-none xl:mb-[18px] xl:px-3 xl:text-[11px] xl:tracking-[0.18em]">
              Uso interno
            </Badge>
            <h1 className="font-display text-[32px] font-extrabold uppercase leading-[0.9] tracking-[0.03em] xl:text-[54px]">
              Control de
              <span className="block text-primary">inventario.</span>
            </h1>
            <p className="mt-5 hidden max-w-[30ch] text-base leading-[1.65] text-white/70 xl:block">
              Existencias, movimientos y cargas de Nómada Moto Partes en un solo lugar.
            </p>
          </div>

          <div className="relative hidden flex-col gap-3.5 xl:flex">
            <div className="flex items-stretch gap-[26px]">
              <div>
                <p className="font-display text-2xl font-extrabold leading-none tabular-nums">2.418</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-white/50">Referencias</p>
              </div>
              <span className="w-px bg-white/10" aria-hidden="true" />
              <div>
                <p className="font-display text-2xl font-extrabold leading-none tabular-nums">90</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-white/50">Días de traza</p>
              </div>
            </div>
            <span className="flex items-center gap-2 text-[12.5px] text-white/55">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Acceso restringido a personal autorizado
            </span>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-background px-4 pb-8 pt-16 sm:p-10 xl:px-16">
          <ThemeToggle className="absolute right-4 top-4 sm:right-8 sm:top-8" />
          <div className="w-full max-w-[360px]">
            <h2 className="font-display text-[22px] font-extrabold uppercase tracking-[0.02em] sm:text-[26px]">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground sm:text-[13.5px]">
              Ingresa con tu correo corporativo para consultar y actualizar existencias.
            </p>
            <div className="mt-6">
              {configured ? (
                <LoginForm passwordUpdated={passwordUpdated} />
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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
