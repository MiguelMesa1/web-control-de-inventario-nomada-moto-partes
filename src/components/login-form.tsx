"use client";

import { CheckCircle2, Eye, EyeOff, Info, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import {
  signInAction,
  type LoginState,
} from "@/app/(auth)/login/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm({ passwordUpdated = false }: { passwordUpdated?: boolean }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <Alert variant="destructive" role="alert">
          <LockKeyhole aria-hidden="true" />
          <AlertTitle>No pudimos entrar</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {passwordUpdated && !state.error && (
        <Alert role="status">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Contraseña actualizada</AlertTitle>
          <AlertDescription>
            Inicia sesión con tu contraseña nueva.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Correo electrónico
        </Label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="tu@nomadamotopartes.co"
            className="h-[46px] pl-10 focus-visible:border-foreground focus-visible:ring-primary/35 lg:h-[46px]"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Contraseña
          </Label>
          <a href="#login-help" className="text-[11.5px] font-medium text-warning underline underline-offset-2">
            ¿Olvidaste?
          </a>
        </div>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-[46px] px-10 focus-visible:border-foreground focus-visible:ring-primary/35 lg:h-[46px]"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-12 sm:h-[46px] lg:h-[46px]"
      >
        {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
        {pending ? "Iniciando sesión…" : "Entrar"}
      </Button>

      <p id="login-help" className="flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        El acceso es privado. Si necesitas una cuenta o olvidaste tu contraseña,
        habla con un administrador.
      </p>
    </form>
  );
}
