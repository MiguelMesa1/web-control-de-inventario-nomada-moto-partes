const asOrigin = (value: string | undefined) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export function configuredAppOrigins(requestOrigin?: string) {
  const values = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.APP_ALLOWED_ORIGINS?.split(",") ?? []),
    requestOrigin,
  ];
  return new Set(values.map((value) => asOrigin(value?.trim())).filter(Boolean));
}

export function isAllowedAppOrigin(origin: string | null, requestOrigin: string) {
  if (!origin) return false;
  const normalized = asOrigin(origin);
  return normalized !== null && configuredAppOrigins(requestOrigin).has(normalized);
}

export function buildContentSecurityPolicy(nonce: string) {
  const backendOrigin = asOrigin(process.env.NEXT_PUBLIC_INSFORGE_URL);
  const development = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self'${backendOrigin ? ` ${backendOrigin}` : ""}${development ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
  if (!development) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
