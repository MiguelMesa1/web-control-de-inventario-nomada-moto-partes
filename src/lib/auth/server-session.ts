const SESSION_COOKIE_NAME = "nomada_session_policy";
const SESSION_IDLE_SECONDS = 60 * 60;
const SESSION_ABSOLUTE_SECONDS = 12 * 60 * 60;

type SessionTimes = { issuedAt: number; lastActivityAt: number };

function sessionSecret() {
  const source = process.env.SESSION_COOKIE_SECRET ?? process.env.INSFORGE_API_KEY;
  if (!source) return null;
  return `nomada-session-policy-v1:${source}`;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signature(payload: string) {
  const secret = sessionSecret();
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(signed));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createServerSessionValue(times?: Partial<SessionTimes>) {
  const now = Math.floor(Date.now() / 1000);
  const payload = `${times?.issuedAt ?? now}.${times?.lastActivityAt ?? now}`;
  const digest = await signature(payload);
  return digest ? `v1.${payload}.${digest}` : null;
}

export async function readServerSessionValue(value: string | undefined) {
  if (!value) return null;
  const [version, issuedRaw, activityRaw, suppliedSignature, extra] = value.split(".");
  if (version !== "v1" || extra !== undefined || !suppliedSignature) return null;
  const issuedAt = Number(issuedRaw);
  const lastActivityAt = Number(activityRaw);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(lastActivityAt)) return null;
  const expected = await signature(`${issuedRaw}.${activityRaw}`);
  if (!expected || !constantTimeEqual(expected, suppliedSignature)) return null;
  return { issuedAt, lastActivityAt };
}

export function serverSessionExpired(times: SessionTimes, now = Math.floor(Date.now() / 1000)) {
  return (
    times.issuedAt > now + 60 ||
    times.lastActivityAt < times.issuedAt ||
    now - times.lastActivityAt > SESSION_IDLE_SECONDS ||
    now - times.issuedAt > SESSION_ABSOLUTE_SECONDS
  );
}

export const serverSessionCookie = {
  name: SESSION_COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_ABSOLUTE_SECONDS,
  },
};

