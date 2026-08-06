import { describe, expect, it } from "vitest";
import {
  isSessionIdle,
  SESSION_HEARTBEAT_INTERVAL_MS,
  SESSION_IDLE_TIMEOUT_MS,
  shouldRefreshSession,
} from "@/lib/auth/session-activity";

describe("session activity", () => {
  it("keeps an active session open before one hour of inactivity", () => {
    expect(isSessionIdle(0, SESSION_IDLE_TIMEOUT_MS - 1)).toBe(false);
  });

  it("marks the session idle at one hour without activity", () => {
    expect(isSessionIdle(0, SESSION_IDLE_TIMEOUT_MS)).toBe(true);
  });

  it("refreshes an active session every five minutes", () => {
    expect(
      shouldRefreshSession({
        lastActivityAt: SESSION_HEARTBEAT_INTERVAL_MS,
        lastRefreshAt: 0,
        now: SESSION_HEARTBEAT_INTERVAL_MS,
      }),
    ).toBe(true);
  });

  it("does not refresh a session that already reached the idle limit", () => {
    expect(
      shouldRefreshSession({
        lastActivityAt: 0,
        lastRefreshAt: 0,
        now: SESSION_IDLE_TIMEOUT_MS,
      }),
    ).toBe(false);
  });
});
