"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
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

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <Alert variant="destructive" role="alert">
          <LockKeyhole aria-hidden="true" />
          <AlertTitle>No pudimos entrar</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo electrónico</Label>
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
            className="h-11 pl-10"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
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
            className="h-11 px-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 shadow-[0_5px_16px_rgba(240,227,0,0.2)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_8px_22px_rgba(240,227,0,0.3)] active:translate-y-0 disabled:shadow-none"
      >
        {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-foreground/70">
        El acceso es privado. Si necesitas una cuenta, habla con un administrador.
      </p>
    </form>
  );
}
