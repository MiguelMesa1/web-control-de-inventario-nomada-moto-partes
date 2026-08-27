"use client";

import { Check, Crown, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { PasswordResetDialog } from "@/components/password-reset-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserProfile, UserRole } from "@/types/inventory";
import { canResetPassword } from "@/lib/auth/password-reset";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  reader: "Solo lectura",
  uploader: "Carga y documentos",
  blocked: "Sin acceso",
};

const relativeTime = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

function formatLastAccess(value?: string) {
  if (!value) return "Sin registro";
  const then = new Date(value).getTime();
  const diffMinutes = Math.round((then - Date.now()) / 60000);
  if (Math.abs(diffMinutes) < 60) return relativeTime.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relativeTime.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return relativeTime.format(diffDays, "day");
}

/** Panel de permisos (README §"09 · Usuarios y permisos"): lo que cada rol
 *  puede y no puede hacer, derivado de las comprobaciones `profile.role`
 *  que ya existen en el resto de la app — no es una fuente nueva de verdad,
 *  solo hace visible lo que hoy solo vive en el código. */
const permissionMatrix: Array<{ label: string; admin: boolean; uploader: boolean; reader: boolean }> = [
  { label: "Consultar inventario y analítica", admin: true, uploader: true, reader: true },
  { label: "Cargar nuevo inventario", admin: true, uploader: true, reader: false },
  { label: "Adjuntar documentos a productos", admin: true, uploader: true, reader: false },
  { label: "Editar recompra y kits plásticos", admin: true, uploader: false, reader: false },
  { label: "Gestionar usuarios y permisos", admin: true, uploader: false, reader: false },
  { label: "Cambiar configuración del portal", admin: true, uploader: false, reader: false },
];

function PermissionCell({ granted }: { granted: boolean }) {
  return granted ? (
    <Check className="size-4 text-success" aria-hidden="true" />
  ) : (
    <X className="size-4 text-muted-foreground/50" aria-hidden="true" />
  );
}

export function AdminUsers({
  initialUsers,
  currentUser,
  isDemo,
}: {
  initialUsers: UserProfile[];
  currentUser: UserProfile;
  isDemo: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);

  async function updateRole(user: UserProfile, role: UserRole) {
    if (user.isPrimary) return;
    setBusyId(user.id);
    try {
      if (!isDemo) {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: user.id, role }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? { ...item, role, active: role !== "blocked" }
            : item,
        ),
      );
      toast.success("Permiso actualizado", {
        description: `${user.displayName}: ${roleLabels[role]}.`,
      });
    } catch (error) {
      toast.error("No pudimos cambiar el permiso", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setBusyId("");
    }
  }

  async function createUser(formData: FormData) {
    setCreating(true);
    try {
      const payload = {
        displayName: String(formData.get("displayName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        role: String(formData.get("role") ?? "reader") as UserRole,
      };
      let newUser: UserProfile = {
        id: crypto.randomUUID(),
        ...payload,
        active: true,
        isPrimary: false,
      };
      if (!isDemo) {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as {
          message?: string;
          user?: UserProfile;
        };
        if (!response.ok || !body.user) throw new Error(body.message);
        newUser = body.user;
      }
      setUsers((current) => [...current, newUser]);
      setDialogOpen(false);
      toast.success("Usuario creado", {
        description: `${payload.displayName} ya puede iniciar sesión.`,
      });
    } catch (error) {
      toast.error("No pudimos crear el usuario", {
        description:
          error instanceof Error ? error.message : "Revisa los datos e intenta de nuevo.",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios y permisos"
        subtitle={`${users.length} ${users.length === 1 ? "cuenta" : "cuentas"} con acceso`}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus /> Nuevo usuario</Button>
            </DialogTrigger>
            <DialogContent>
              <form action={createUser}>
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl uppercase">
                    Crear usuario
                  </DialogTitle>
                  <DialogDescription>
                    Entrega la contraseña inicial por un canal seguro.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Nombre</Label>
                    <Input id="displayName" name="displayName" required minLength={2} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña inicial</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      aria-describedby="password-rules"
                    />
                    <p id="password-rules" className="text-xs text-muted-foreground">
                      Entre 8 y 128 caracteres. Evita claves comunes o fáciles de adivinar.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Permiso</Label>
                    <Select name="role" defaultValue="reader">
                      <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reader">Solo lectura</SelectItem>
                        <SelectItem value="uploader">Carga y documentos</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="blocked">Sin acceso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating && <LoaderCircle className="animate-spin" />}
                    {creating ? "Creando…" : "Crear cuenta"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl uppercase">
              Activos · {users.length}
            </CardTitle>
            <CardDescription>
              Los administradores comparten capacidades operativas; la cuenta
              principal permanece protegida contra bloqueo o eliminación
              accidental.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex h-10 items-center gap-4 border-y bg-table-header px-4 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Usuario</span>
              <span className="w-48 shrink-0">Permiso</span>
              <span className="w-28 shrink-0 text-right">Último acceso</span>
              <span className="w-40 shrink-0 text-right">Contraseña</span>
            </div>
            <div className="divide-y divide-row-separator">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:gap-4 sm:py-0"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                      {user.isPrimary ? (
                        <Crown className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <ShieldCheck className="size-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{user.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    {user.role === "blocked" && (
                      <Badge variant="destructive" className="shrink-0">Bloqueado</Badge>
                    )}
                  </div>
                  <div className="w-full sm:w-48 sm:shrink-0">
                    <Select
                      value={user.role}
                      disabled={user.isPrimary || busyId === user.id}
                      onValueChange={(value) => updateRole(user, value as UserRole)}
                    >
                      <SelectTrigger
                        className="h-8"
                        aria-label={`Permiso de ${user.displayName}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {user.isPrimary && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Cuenta protegida</p>
                    )}
                  </div>
                  <p className="w-full text-xs text-muted-foreground sm:w-28 sm:shrink-0 sm:text-right">
                    {formatLastAccess(user.lastLoginAt)}
                  </p>
                  <div className="w-full sm:w-40 sm:shrink-0 sm:text-right">
                    {canResetPassword(currentUser, user) ? (
                      <PasswordResetDialog
                        target={user}
                        disabled={isDemo}
                        triggerLabel={
                          currentUser.id === user.id ? "Cambiar la mía" : "Restablecer"
                        }
                        triggerVariant="outline"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {user.isPrimary
                          ? "Solo puede cambiarla el titular"
                          : "Reservado al admin principal"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-display text-lg uppercase">Permisos por rol</CardTitle>
            <CardDescription>Lo que cada rol puede y no puede hacer.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex h-9 items-center gap-2 border-y bg-table-header px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="flex-1">Acción</span>
              <span className="w-9 text-center">Admin</span>
              <span className="w-9 text-center">Carga</span>
              <span className="w-9 text-center">Lectura</span>
            </div>
            <div className="divide-y divide-row-separator">
              {permissionMatrix.map((row) => (
                <div key={row.label} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="flex-1 text-xs leading-snug">{row.label}</span>
                  <span className="grid w-9 place-items-center"><PermissionCell granted={row.admin} /></span>
                  <span className="grid w-9 place-items-center"><PermissionCell granted={row.uploader} /></span>
                  <span className="grid w-9 place-items-center"><PermissionCell granted={row.reader} /></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
