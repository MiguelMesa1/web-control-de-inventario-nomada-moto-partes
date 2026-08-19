"use client";

import { Crown, LoaderCircle, Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserProfile, UserRole } from "@/types/inventory";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  reader: "Solo lectura",
  uploader: "Carga y documentos",
  blocked: "Sin acceso",
};

export function AdminUsers({
  initialUsers,
  isDemo,
}: {
  initialUsers: UserProfile[];
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
        eyebrow="Control de acceso"
        title="Usuarios y permisos"
        description="El registro público está cerrado. Los administradores crean cuentas y definen su alcance."
        icon={Users}
        action={
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
                      minLength={12}
                      maxLength={128}
                      pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}"
                      aria-describedby="password-rules"
                    />
                    <p id="password-rules" className="text-xs text-muted-foreground">
                      Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.
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

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">Equipo con acceso</CardTitle>
          <CardDescription>
            Los administradores comparten capacidades operativas; la cuenta principal
            permanece protegida contra bloqueo o eliminación accidental.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="min-w-60">Permiso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground">
                        {user.isPrimary ? <Crown className="size-4 text-primary" /> : <ShieldCheck className="size-4" />}
                      </div>
                      <div>
                        <p className="font-semibold">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "blocked" ? "destructive" : "secondary"}>
                      {user.role === "blocked" ? "Bloqueado" : "Activo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={user.isPrimary || busyId === user.id}
                      onValueChange={(value) => updateRole(user, value as UserRole)}
                    >
                      <SelectTrigger aria-label={`Permiso de ${user.displayName}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {user.isPrimary && (
                      <p className="mt-1 text-xs text-muted-foreground">Cuenta protegida</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
