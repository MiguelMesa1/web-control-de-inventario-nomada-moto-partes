import { describe, expect, it } from "vitest";
import {
  parseFiniteNumber,
  sanitizeEmail,
  sanitizeText,
  sanitizeUuid,
} from "./input";

describe("backend input validation", () => {
  it("normalizes harmless text and removes control and bidi characters", () => {
    expect(sanitizeText("  Kit\u0000   NS\u202e 200  ", { maxLength: 40 })).toBe(
      "Kit NS 200",
    );
  });

  it("rejects oversized values instead of silently truncating them", () => {
    expect(sanitizeText("12345", { maxLength: 4 })).toBeNull();
  });

  it("validates normalized emails, UUIDs and bounded integers", () => {
    expect(sanitizeEmail(" ADMIN@Example.COM ")).toBe("admin@example.com");
    expect(sanitizeUuid("not-a-uuid")).toBeNull();
    expect(parseFiniteNumber("12", { integer: true, min: 0, max: 20 })).toBe(12);
    expect(parseFiniteNumber("12.5", { integer: true, min: 0, max: 20 })).toBeNull();
  });
});
