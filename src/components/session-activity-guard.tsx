"use client";

import { useEffect } from "react";
import { signOutAction } from "@/app/(auth)/login/actions";
import {
  isSessionIdle,
  shouldRefreshSession,
} from "@/lib/auth/session-activity";

const ACTIVITY_STORAGE_KEY = "nomada:last-session-activity";
const HEARTBEAT_STORAGE_KEY = "nomada:last-session-heartbeat";
const ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

function readTimestamp(key: string) {
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function writeTimestamp(key: string, value: number) {
  window.localStorage.setItem(key, String(value));
}

export function SessionActivityGuard({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    let lastActivityAt = Math.max(Date.now(), readTimestamp(ACTIVITY_STORAGE_KEY));
    let lastActivityWriteAt = lastActivityAt;
    let refreshInFlight = false;
    let signingOut = false;
    writeTimestamp(ACTIVITY_STORAGE_KEY, lastActivityAt);

    const refreshSession = async (now: number) => {
      const sharedHeartbeatAt = readTimestamp(HEARTBEAT_STORAGE_KEY);
      if (
        refreshInFlight ||
        !navigator.onLine ||
        !shouldRefreshSession({
          lastActivityAt,
          lastRefreshAt: sharedHeartbeatAt,
          now,
        })
      ) {
        return;
      }

      refreshInFlight = true;
      writeTimestamp(HEARTBEAT_STORAGE_KEY, now);
      try {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch {
        // A temporary network failure is retried on the next heartbeat window.
      } finally {
        refreshInFlight = false;
      }
    };

    const recordActivity = () => {
      const now = Date.now();
      lastActivityAt = now;
      if (now - lastActivityWriteAt >= ACTIVITY_WRITE_INTERVAL_MS) {
        lastActivityWriteAt = now;
        writeTimestamp(ACTIVITY_STORAGE_KEY, now);
      }
      void refreshSession(now);
    };

    const checkSession = () => {
      const now = Date.now();
      lastActivityAt = Math.max(lastActivityAt, readTimestamp(ACTIVITY_STORAGE_KEY));
      if (isSessionIdle(lastActivityAt, now)) {
        if (!signingOut) {
          signingOut = true;
          window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
          window.localStorage.removeItem(HEARTBEAT_STORAGE_KEY);
          void signOutAction();
        }
        return;
      }
      if (document.visibilityState === "visible") void refreshSession(now);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVITY_STORAGE_KEY || !event.newValue) return;
      const sharedActivityAt = Number(event.newValue);
      if (Number.isFinite(sharedActivityAt)) {
        lastActivityAt = Math.max(lastActivityAt, sharedActivityAt);
      }
    };

    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", checkSession);
    const intervalId = window.setInterval(checkSession, SESSION_CHECK_INTERVAL_MS);
    void refreshSession(Date.now());

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", checkSession);
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  return null;
}
