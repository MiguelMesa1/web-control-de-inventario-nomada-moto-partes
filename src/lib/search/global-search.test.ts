import { describe, expect, it } from "vitest";
import type { InventoryItem, PurchaseOrder } from "@/types/inventory";
import { buildGlobalSearchResults } from "./global-search";

const inventory: InventoryItem[] = [
  {
    sku: "NM-001",
    productName: "Pastillas de freno cerámicas",
    productLine: "Frenos",
    warehouse: "Principal",
    stock: 8,
    reserved: 2,
    available: 6,
    sourceExportedAt: "2026-08-26T00:00:00.000Z",
  },
];

const orders: PurchaseOrder[] = [
  {
    id: "order-1",
    orderNumber: "PED-001",
    supplierName: "Moto Centro",
    createdBy: "user-1",
    createdByName: "Nómada",
    status: "ordered",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    items: [],
  },
];

describe("buildGlobalSearchResults", () => {
  it("encuentra productos sin depender de tildes", () => {
    const results = buildGlobalSearchResults("ceramicas", inventory, orders);
    expect(results.products[0]).toMatchObject({
      sku: "NM-001",
      href: "/inventory?sku=NM-001",
    });
  });

  it("crea destinos funcionales para líneas y pedidos", () => {
    expect(buildGlobalSearchResults("fren", inventory, orders).lines[0]).toEqual(
      { productLine: "Frenos", href: "/inventory?line=Frenos" },
    );
    expect(buildGlobalSearchResults("PED-001", inventory, orders).orders[0])
      .toMatchObject({ id: "order-1", href: "/orders?order=order-1&search=PED-001" });
  });
});
