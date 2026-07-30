import { describe, expect, it } from "vitest";
import {
  compareProductLines,
  getStockLevel,
  isPriorityProductLine,
  normalizeInventoryText,
} from "@/lib/inventory/priority-lines";

describe("priority inventory lines", () => {
  it("recognizes the six priority lines from the Effi export", () => {
    expect(isPriorityProductLine("XTZ 125")).toBe(true);
    expect(isPriorityProductLine("Pulsar NS 125-150-160-200")).toBe(true);
    expect(isPriorityProductLine("SuperLander")).toBe(true);
    expect(isPriorityProductLine("Yamaha")).toBe(false);
  });

  it("puts priority lines before the rest", () => {
    const lines = ["Yamaha", "XTZ 150", "Boxer", "Akt"].sort(
      compareProductLines,
    );
    expect(lines).toEqual(["XTZ 150", "Boxer", "Akt", "Yamaha"]);
  });

  it("normalizes accents and assigns readable inventory levels", () => {
    expect(normalizeInventoryText("  LÍNEA XTZ 150 ")).toBe("linea xtz 150");
    expect(getStockLevel(0, 5)).toBe("exhausted");
    expect(getStockLevel(5, 5)).toBe("low");
    expect(getStockLevel(10, 5)).toBe("medium");
    expect(getStockLevel(15, 5)).toBe("high");
  });
});
