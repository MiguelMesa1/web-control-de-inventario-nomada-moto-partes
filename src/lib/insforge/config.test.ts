import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInsForgeConnectionSettings,
  isInsForgeConfigured,
} from "./config";

describe("server-only InsForge configuration", () => {
  beforeEach(() => {
    vi.stubEnv("INSFORGE_URL", undefined);
    vi.stubEnv("INSFORGE_ANON_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("connects with private server environment variables", () => {
    vi.stubEnv("INSFORGE_URL", "https://backend.example");
    vi.stubEnv("INSFORGE_ANON_KEY", "private-test-key");

    expect(getInsForgeConnectionSettings()).toEqual({
      baseUrl: "https://backend.example",
      anonKey: "private-test-key",
    });
    expect(isInsForgeConfigured()).toBe(true);
  });

  it("never uses a public anonymous key as a fallback", () => {
    vi.stubEnv("INSFORGE_URL", "https://backend.example");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", "public-test-key");

    expect(getInsForgeConnectionSettings().anonKey).toBeUndefined();
    expect(isInsForgeConfigured()).toBe(false);
  });

  it("does not accept the legacy public connection variables", () => {
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_URL", "https://backend.example");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", "public-test-key");

    expect(getInsForgeConnectionSettings()).toEqual({
      baseUrl: undefined,
      anonKey: undefined,
    });
    expect(isInsForgeConfigured()).toBe(false);
  });

  it.each([undefined, "", "not-a-url"])(
    "rejects missing or invalid backend URL: %s",
    (baseUrl) => {
      vi.stubEnv("INSFORGE_URL", baseUrl);
      vi.stubEnv("INSFORGE_ANON_KEY", "private-test-key");

      expect(isInsForgeConfigured()).toBe(false);
    },
  );
});
