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

export function getRateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
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
  const bucket = existing?.blockedUntil && existing.blockedUntil > now
    ? existing
    : !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + config.windowMs, blockedUntil: 0 }
      : existing;

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
    bucket.blockedUntil = now + config.cooldownMs;
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
