"use client";

import { Eye, EyeOff, KeyRound, LoaderCircle, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserProfile } from "@/types/inventory";

type PasswordResetDialogProps = {
  target?: UserProfile;
  disabled?: boolean;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

export function PasswordResetDialog({
  target,
  disabled = false,
  triggerLabel = "Cambiar contraseña",
  triggerVariant = "outline",
}: PasswordResetDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const targetUserId = target?.id;
  const targetLabel = target?.displayName ?? "tu cuenta";
  const targetEmail = target?.email;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCodeSent(false);
      setShowPassword(false);
    }
  }

  async function requestCode() {
    setRequesting(true);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message);
      setCodeSent(true);
      toast.success("Código enviado", {
        description: `Revisa ${targetEmail ?? "el correo de tu cuenta"}.`,
      });
    } catch (error) {
      toast.error("No pudimos enviar el código", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setRequesting(false);
    }
  }

  async function completeReset(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/password-reset/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          code: String(formData.get("code") ?? ""),
          newPassword,
        }),
      });
      const body = (await response.json()) as {
        message?: string;
        signedOut?: boolean;
      };
      if (!response.ok) throw new Error(body.message);

      handleOpenChange(false);
      toast.success("Contraseña actualizada", {
        description: body.signedOut
          ? "Inicia sesión nuevamente con tu contraseña nueva."
          : `${targetLabel} ya puede usar la contraseña nueva.`,
      });
      if (body.signedOut) {
        router.replace("/login?password=updated");
        router.refresh();
      }
    } catch (error) {
      toast.error("No pudimos cambiar la contraseña", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} disabled={disabled}>
          <KeyRound /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            Contraseña de {targetLabel}
          </DialogTitle>
          <DialogDescription>
            Por seguridad, enviaremos un código de 6 dígitos a {targetEmail ?? "tu correo"}.
            La contraseña anterior nunca se muestra.
          </DialogDescription>
        </DialogHeader>

        {!codeSent ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              El código vence pronto y solo puede usarse una vez. No lo compartas fuera
              del proceso de cambio de contraseña.
            </div>
            <DialogFooter>
              <Button onClick={requestCode} disabled={requesting}>
                {requesting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <MailCheck />
                )}
                {requesting ? "Enviando…" : "Enviar código"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={completeReset} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`reset-code-${targetUserId ?? "self"}`}>Código de seguridad</Label>
              <Input
                id={`reset-code-${targetUserId ?? "self"}`}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                placeholder="000000"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`new-password-${targetUserId ?? "self"}`}>Contraseña nueva</Label>
              <div className="relative">
                <Input
                  id={`new-password-${targetUserId ?? "self"}`}
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  className="pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Entre 8 y 128 caracteres. Evita claves comunes o fáciles de adivinar.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`confirm-password-${targetUserId ?? "self"}`}>
                Confirmar contraseña nueva
              </Label>
              <Input
                id={`confirm-password-${targetUserId ?? "self"}`}
                name="confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={requestCode}
              >
                Enviar otro código
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="animate-spin" />}
                {saving ? "Actualizando…" : "Guardar contraseña"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
