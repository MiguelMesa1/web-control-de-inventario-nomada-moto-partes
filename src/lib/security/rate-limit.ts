type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let requestsSinceCleanup = 0;

export function checkRateLimit(
  options: RateLimitOptions,
  now = Date.now(),
) {
  if (++requestsSinceCleanup >= 500) {
    requestsSinceCleanup = 0;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const current = buckets.get(options.key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
  bucket.count += 1;
  buckets.set(options.key, bucket);

  return {
    allowed: bucket.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
  requestsSinceCleanup = 0;
}
