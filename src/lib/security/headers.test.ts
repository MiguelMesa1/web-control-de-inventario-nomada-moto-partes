import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy, isAllowedAppOrigin } from "./headers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers", () => {
  it("allows only exact configured origins", () => {
    vi.stubEnv("APP_ALLOWED_ORIGINS", "https://inventory.example");
    expect(isAllowedAppOrigin("https://inventory.example", "https://local.example")).toBe(true);
    expect(isAllowedAppOrigin("https://inventory.example.attacker.test", "https://local.example")).toBe(false);
  });

  it("uses a nonce and removes unsafe script directives in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const policy = buildContentSecurityPolicy("abc123");
    expect(policy).toContain("'nonce-abc123'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });
});
