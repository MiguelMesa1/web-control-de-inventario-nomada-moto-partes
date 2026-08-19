import { describe, expect, it } from "vitest";
import { purchaseCartStorageKey } from "@/lib/orders/cart-storage";

describe("purchaseCartStorageKey", () => {
  it("aísla el carrito por usuario", () => {
    expect(purchaseCartStorageKey("usuario-a")).not.toBe(
      purchaseCartStorageKey("usuario-b"),
    );
    expect(purchaseCartStorageKey("usuario-a")).toContain("usuario-a");
  });
});
