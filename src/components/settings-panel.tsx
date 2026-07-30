"use client";

import { Save, Settings2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useInventoryData } from "@/components/providers/inventory-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsPanel() {
  const { lowStockThreshold, isDemo } = useInventoryData();
  const profile = useProfile();
  const [threshold, setThreshold] = useState(lowStockThreshold);
  const [saving, setSaving] = useState(false);
  const isAdmin = profile.role === "admin";

  async function save() {
    setSaving(true);
    try {
      if (!isDemo) {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lowStockThreshold: threshold }),
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(body.message);
      }
      toast.success("Configuración guardada", {
        description: `Inventario bajo: ${threshold} unidades o menos.`,
      });
    } catch (error) {
      toast.error("No pudimos guardar", {
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reglas del portal"
        title="Configuración"
        description="Ajusta los criterios que alimentan alertas, rankings y gráficas."
        icon={Settings2}
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl uppercase">
            Umbral de inventario bajo
          </CardTitle>
          <CardDescription>
            Se considera bajo cuando el disponible es mayor que cero y menor o
            igual al umbral.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="threshold">Unidades disponibles</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={9999}
              value={threshold}
              disabled={!isAdmin}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="max-w-48"
            />
          </div>
          <Alert>
            <ShieldCheck />
            <AlertTitle>Cambio auditable</AlertTitle>
            <AlertDescription>
              El valor se aplica a todo el portal y registra quién lo modificó.
            </AlertDescription>
          </Alert>
          <Button className="w-fit" disabled={!isAdmin || saving} onClick={save}>
            <Save /> {saving ? "Guardando…" : "Guardar regla"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
