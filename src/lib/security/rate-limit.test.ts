import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "./rate-limit";

describe("rate limiting", () => {
  beforeEach(resetRateLimitsForTests);

  it("blocks requests over the limit and resets after the window", () => {
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000 }, 0).allowed).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000 }, 10).allowed).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000 }, 20).allowed).toBe(false);
    expect(checkRateLimit({ key: "a", limit: 2, windowMs: 1000 }, 1000).allowed).toBe(true);
  });
});
