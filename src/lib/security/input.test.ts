import { describe, expect, it } from "vitest";
import {
  parseFiniteNumber,
  readJsonObject,
  sanitizeEmail,
  sanitizeText,
  sanitizeUuid,
} from "./input";
import { requireJsonRequest } from "./request";

describe("backend input validation", () => {
  it.each([undefined, "2"])("bounds actual JSON bytes with content-length %s", async (contentLength) => {
    const request = new Request("https://inventory.example/api", {
      method: "POST",
      headers: {
        origin: "https://inventory.example",
        "content-type": "application/json",
        ...(contentLength ? { "content-length": contentLength } : {}),
      },
      body: JSON.stringify({ value: "é".repeat(20) }),
    });
    expect(requireJsonRequest(request, 30)).toBeNull();
    expect((await readJsonObject(request)).error?.status).toBe(413);
  });

  it("accepts JSON within the actual byte limit", async () => {
    const request = new Request("https://inventory.example/api", {
      method: "POST",
      headers: { origin: "https://inventory.example", "content-type": "application/json" },
      body: '{"ok":true}',
    });
    expect(requireJsonRequest(request, 11)).toBeNull();
    expect((await readJsonObject(request)).data).toEqual({ ok: true });
  });
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
