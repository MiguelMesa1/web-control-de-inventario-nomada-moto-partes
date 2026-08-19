import { describe, expect, it, vi } from "vitest";
import { loadActiveOrderSkus } from "@/lib/orders/active-order-data";

describe("loadActiveOrderSkus", () => {
  it("devuelve referencias únicas de pedidos en borrador o en curso", async () => {
    const statusResult = {
      data: [{ id: "order-1" }, { id: "order-2" }],
      error: null,
    };
    const itemResult = {
      data: [{ sku: "SKU-1" }, { sku: "SKU-1" }, { sku: "SKU-2" }],
      error: null,
    };
    const orderQuery = { select: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() };
    orderQuery.select.mockReturnValue(orderQuery);
    orderQuery.in.mockReturnValue(orderQuery);
    orderQuery.order.mockReturnValue(orderQuery);
    orderQuery.range.mockResolvedValueOnce(statusResult).mockResolvedValueOnce({ data: [], error: null });
    const itemQuery = { select: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() };
    itemQuery.select.mockReturnValue(itemQuery);
    itemQuery.in.mockReturnValue(itemQuery);
    itemQuery.order.mockReturnValue(itemQuery);
    itemQuery.range.mockResolvedValueOnce(itemResult).mockResolvedValueOnce({ data: [], error: null });
    const from = vi.fn((table: string) => table === "purchase_orders" ? orderQuery : itemQuery);

    const result = await loadActiveOrderSkus({
      database: { from },
    } as unknown as Parameters<typeof loadActiveOrderSkus>[0]);

    expect(orderQuery.in).toHaveBeenCalledWith("status", ["draft", "ordered"]);
    expect(itemQuery.in).toHaveBeenCalledWith("order_id", ["order-1", "order-2"]);
    expect(orderQuery.range).toHaveBeenCalledWith(0, 999);
    expect(itemQuery.range).toHaveBeenCalledWith(0, 999);
    expect(result).toEqual(["SKU-1", "SKU-2"]);
  });
});
