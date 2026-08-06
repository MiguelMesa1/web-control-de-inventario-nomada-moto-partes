import { demoPlasticKits } from "@/lib/demo-data";
import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import type { PlasticKitDefinition, PlasticKitPartDefinition } from "@/types/inventory";

type DbPlasticKit = {
  id: string;
  name: string;
  brand: string;
  color: string;
  has_headlight: boolean | null;
  model: string | null;
  warehouse: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type DbPlasticKitPart = {
  id: string;
  kit_id: string;
  sku: string;
  product_name: string;
  quantity_required: number | string;
  position: number | string;
};

function isMissingPlasticKitTables(message: string) {
  return /plastic_kits|plastic_kit_parts/i.test(message) &&
    /does not exist|not found|relation|schema cache/i.test(message);
}

export async function loadPlasticKitDefinitions(): Promise<PlasticKitDefinition[]> {
  if (!isInsForgeConfigured()) return demoPlasticKits;

  const insforge = await createAuthenticatedInsForgeServerClient();
  const [kitsResult, partsResult] = await Promise.all([
    insforge.database
      .from("plastic_kits")
      .select("id,name,brand,color,has_headlight,model,warehouse,active,created_at,updated_at")
      .order("brand")
      .order("model")
      .order("name"),
    insforge.database
      .from("plastic_kit_parts")
      .select("id,kit_id,sku,product_name,quantity_required,position")
      .order("kit_id")
      .order("position"),
  ]);

  const firstError = kitsResult.error ?? partsResult.error;
  if (firstError) {
    if (isMissingPlasticKitTables(firstError.message)) return [];
    throw new Error(firstError.message);
  }

  const partsByKit = new Map<string, PlasticKitPartDefinition[]>();
  for (const part of (partsResult.data ?? []) as DbPlasticKitPart[]) {
    const mapped: PlasticKitPartDefinition = {
      id: String(part.id),
      sku: String(part.sku),
      productName: String(part.product_name),
      quantityRequired: Number(part.quantity_required),
      position: Number(part.position),
    };
    const kitParts = partsByKit.get(String(part.kit_id)) ?? [];
    kitParts.push(mapped);
    partsByKit.set(String(part.kit_id), kitParts);
  }

  return ((kitsResult.data ?? []) as DbPlasticKit[]).map((kit) => ({
    id: String(kit.id),
    name: String(kit.name),
    brand: String(kit.brand),
    color: String(kit.color),
    hasHeadlight:
      kit.has_headlight === null ? null : Boolean(kit.has_headlight),
    model: kit.model ? String(kit.model) : undefined,
    warehouse: String(kit.warehouse),
    active: Boolean(kit.active),
    parts: partsByKit.get(String(kit.id)) ?? [],
    createdAt: String(kit.created_at),
    updatedAt: String(kit.updated_at),
  }));
}
