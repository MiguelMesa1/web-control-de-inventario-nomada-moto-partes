import { describe, expect, it } from "vitest";
import { requireJsonRequest, requireSameOrigin } from "./request";

describe("request write protections", () => {
  it("rejects a cross-origin state-changing request", () => {
    const response = requireSameOrigin(
      new Request("https://inventario.example/api/settings", {
        method: "PATCH",
        headers: { origin: "https://attacker.example" },
      }),
    );

    expect(response?.status).toBe(403);
  });

  it("accepts same-origin JSON within the configured limit", () => {
    const response = requireJsonRequest(
      new Request("https://inventario.example/api/settings", {
        method: "PATCH",
        headers: {
          origin: "https://inventario.example",
          "content-type": "application/json",
          "content-length": "42",
        },
      }),
      100,
    );

    expect(response).toBeNull();
  });

  it("rejects oversized or non-JSON bodies before parsing", () => {
    const response = requireJsonRequest(
      new Request("https://inventario.example/api/settings", {
        method: "PATCH",
        headers: {
          origin: "https://inventario.example",
          "content-type": "application/json",
          "content-length": "101",
        },
      }),
      100,
    );

    expect(response?.status).toBe(413);
  });
});
