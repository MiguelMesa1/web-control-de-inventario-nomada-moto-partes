export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const SESSION_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function isSessionIdle(
  lastActivityAt: number,
  now: number,
  timeoutMs = SESSION_IDLE_TIMEOUT_MS,
) {
  return now - lastActivityAt >= timeoutMs;
}

export function shouldRefreshSession({
  lastActivityAt,
  lastRefreshAt,
  now,
}: {
  lastActivityAt: number;
  lastRefreshAt: number;
  now: number;
}) {
  return (
    !isSessionIdle(lastActivityAt, now) &&
    now - lastRefreshAt >= SESSION_HEARTBEAT_INTERVAL_MS
  );
}
