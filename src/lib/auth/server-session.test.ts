import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerSessionValue,
  readServerSessionValue,
  serverSessionExpired,
} from "./server-session";

describe("server session policy", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_COOKIE_SECRET", "test-secret-with-more-than-thirty-two-characters");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs and validates timestamps without exposing the secret", async () => {
    const value = await createServerSessionValue({ issuedAt: 100, lastActivityAt: 200 });
    expect(value).toBeTruthy();
    expect(value).not.toContain("test-secret");
    await expect(readServerSessionValue(value!)).resolves.toEqual({
      issuedAt: 100,
      lastActivityAt: 200,
    });
  });

  it("rejects a modified cookie", async () => {
    const value = await createServerSessionValue({ issuedAt: 100, lastActivityAt: 200 });
    await expect(readServerSessionValue(value!.replace(".200.", ".201."))).resolves.toBeNull();
  });

  it("enforces both idle and absolute expiration", () => {
    expect(serverSessionExpired({ issuedAt: 0, lastActivityAt: 0 }, 3599)).toBe(false);
    expect(serverSessionExpired({ issuedAt: 0, lastActivityAt: 0 }, 3601)).toBe(true);
    expect(serverSessionExpired({ issuedAt: 1, lastActivityAt: 43_000 }, 43_201)).toBe(false);
    expect(serverSessionExpired({ issuedAt: 1, lastActivityAt: 43_000 }, 43_202)).toBe(true);
  });
});
