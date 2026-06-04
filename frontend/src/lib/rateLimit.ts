import net from "node:net";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  cooldownMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true for a syntactically valid IP address (v4 or v6). */
function isValidIp(value: string): boolean {
  return net.isIP(value.trim()) !== 0;
}

/**
 * Resolves a rate-limit identifier from a request-like object.
 *
 * - When `PROXY_TRUSTED !== "true"` the `x-forwarded-for` header is ignored
 *   entirely; only the server-derived connection IP is used.
 * - When `PROXY_TRUSTED === "true"` the leftmost valid IP in
 *   `x-forwarded-for` is used, falling back to the connection IP.
 *
 * Falls back to `"anonymous"` when no usable identifier can be found.
 */
export function resolveIdentifier(
  request: { headers: { get(name: string): string | null }; ip?: string },
  env: NodeJS.ProcessEnv = process.env,
): string {
  const proxyTrusted = env.PROXY_TRUSTED === "true";

  if (proxyTrusted) {
    const forwarded = request.headers.get("x-forwarded-for");

    if (forwarded) {
      // The header may contain a comma-separated chain of IPs added by
      // successive proxies. The leftmost entry is the original client IP.
      const candidate = forwarded.split(",")[0].trim();

      if (isValidIp(candidate)) {
        return candidate;
      }

      // Header was malformed or invalid — safely fall back to the
      // server-derived connection IP instead of trusting unvalidated input.
    }
  }

  // Proxy trust disabled: ignore x-forwarded-for entirely.

  if (request.ip && isValidIp(request.ip)) {
    return request.ip;
  }

  return "anonymous";
}

export function getRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitConfig {
  return {
    windowMs: positiveInt(env.AI_RATE_LIMIT_WINDOW_MS, 60_000),
    maxRequests: positiveInt(env.AI_RATE_LIMIT_MAX, 10),
    cooldownMs: positiveInt(env.AI_RATE_LIMIT_COOLDOWN_MS, 30_000),
  };
}

export function checkRateLimit(
  identifier: string,
  now = Date.now(),
  config = getRateLimitConfig(),
): RateLimitResult {
  cleanupExpiredBuckets(now);

  const key = identifier || "anonymous";
  const existing = buckets.get(key);

  // --- Security fix: check blockedUntil BEFORE deciding whether to reset ---
  //
  // Old logic reset the bucket whenever `resetAt <= now`, which let blocked
  // users bypass cooldowns simply by waiting for the rate window to expire.
  //
  // Correct logic:
  //   1. If still blocked → keep existing bucket.
  //   2. Else if BOTH window and cooldown expired → reset bucket.
  //   3. Otherwise → continue using existing bucket.
  let bucket: Bucket;

  if (existing && existing.blockedUntil > now) {
    bucket = existing;
  } else if (
    !existing ||
    (existing.resetAt <= now && existing.blockedUntil <= now)
  ) {
    bucket = {
      count: 0,
      resetAt: now + config.windowMs,
      blockedUntil: 0,
    };
  } else {
    bucket = existing;
  }

  if (bucket.blockedUntil > now) {
    buckets.set(key, bucket);

    return {
      allowed: false,
      retryAfterSeconds: secondsUntil(bucket.blockedUntil, now),
      remaining: 0,
    };
  }

  bucket.count += 1;

  if (bucket.count > config.maxRequests) {
    // Clamp the cooldown so it never expires before the active rate window.
    bucket.blockedUntil = Math.max(
      now + config.cooldownMs,
      bucket.resetAt,
    );

    buckets.set(key, bucket);

    return {
      allowed: false,
      retryAfterSeconds: secondsUntil(bucket.blockedUntil, now),
      remaining: 0,
    };
  }

  buckets.set(key, bucket);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(config.maxRequests - bucket.count, 0),
  };
}

export function resetRateLimit(): void {
  buckets.clear();
}

function cleanupExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now && bucket.blockedUntil <= now) {
      buckets.delete(key);
    }
  }
}

function secondsUntil(target: number, now: number): number {
  return Math.max(1, Math.ceil((target - now) / 1000));
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
}