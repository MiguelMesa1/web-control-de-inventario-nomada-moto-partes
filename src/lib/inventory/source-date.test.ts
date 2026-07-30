import { describe, expect, it } from "vitest";
import {
  getBogotaCalendarDate,
  inventorySourceDateToIso,
  isValidInventorySourceDate,
} from "@/lib/inventory/source-date";

describe("inventory source dates", () => {
  it("uses the current calendar date in Bogota", () => {
    expect(getBogotaCalendarDate(new Date("2026-07-30T03:00:00.000Z"))).toBe(
      "2026-07-29",
    );
  });

  it("stores a selected date at the start of that day in Bogota", () => {
    expect(inventorySourceDateToIso("2026-07-30")).toBe(
      "2026-07-30T05:00:00.000Z",
    );
  });

  it("accepts today's file date even when its old noon timestamp is later than now", () => {
    const morningInBogota = new Date("2026-07-30T13:00:00.000Z");

    expect(
      isValidInventorySourceDate(
        "2026-07-30T17:00:00.000Z",
        morningInBogota,
      ),
    ).toBe(true);
  });

  it("rejects a future calendar date", () => {
    const morningInBogota = new Date("2026-07-30T13:00:00.000Z");

    expect(
      isValidInventorySourceDate(
        "2026-07-31T05:00:00.000Z",
        morningInBogota,
      ),
    ).toBe(false);
  });
});
