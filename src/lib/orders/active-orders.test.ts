import { describe, expect, it } from "vitest";
import {
  buildActiveOrderBySku,
  excludeActiveOrderRows,
} from "@/lib/orders/active-orders";
import type { PurchaseOrder } from "@/types/inventory";

function order(
  status: PurchaseOrder["status"],
  orderNumber: string,
  supplierName: string,
  sku: string,
  quantity: number,
): PurchaseOrder {
  return {
    id: orderNumber,
    orderNumber,
    supplierName,
    status,
    createdAt: "2026-08-19T12:00:00.000Z",
    updatedAt: "2026-08-19T12:00:00.000Z",
    items: [
      {
        id: `${orderNumber}-${sku}`,
        orderId: orderNumber,
        sku,
        productName: "Producto de prueba",
        quantity,
        availableAtCreation: 1,
        minimumStock: 5,
        maximumStock: 10,
        createdAt: "2026-08-19T12:00:00.000Z",
      },
    ],
  };
}

describe("buildActiveOrderBySku", () => {
  it("ignora pedidos recibidos y cancelados", () => {
    const result = buildActiveOrderBySku([
      order("received", "OC-1", "Proveedor A", "SKU-1", 4),
      order("cancelled", "OC-2", "Proveedor A", "SKU-2", 6),
    ]);

    expect(result.size).toBe(0);
  });

  it("agrupa las cantidades activas y prioriza el estado en curso", () => {
    const result = buildActiveOrderBySku([
      order("draft", "OC-1", "Proveedor A", "SKU-1", 4),
      order("ordered", "OC-2", "Proveedor B", "SKU-1", 6),
    ]);

    expect(result.get("SKU-1")).toEqual({
      status: "ordered",
      quantity: 10,
      supplierNames: ["Proveedor A", "Proveedor B"],
      orderNumbers: ["OC-1", "OC-2"],
    });
  });

  it("excluye de recompra las referencias con un pedido activo", () => {
    const rows = [
      { sku: "SKU-PENDIENTE", quantity: 5 },
      { sku: "SKU-EN-CURSO", quantity: 8 },
    ];

    expect(excludeActiveOrderRows(rows, ["SKU-EN-CURSO"])).toEqual([
      { sku: "SKU-PENDIENTE", quantity: 5 },
    ]);
  });
});
