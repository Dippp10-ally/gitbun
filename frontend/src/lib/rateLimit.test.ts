import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit, resolveIdentifier } from "./rateLimit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal request-like object for resolveIdentifier tests. */
function makeRequest(
  forwardedFor: string | null,
  ip?: string,
): { headers: { get(name: string): string | null }; ip?: string } {
  return {
    headers: { get: (name: string) => (name === "x-forwarded-for" ? forwardedFor : null) },
    ...(ip !== undefined ? { ip } : {}),
  };
}

// ---------------------------------------------------------------------------
// Existing rate-limiting tests (unchanged)
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("allows requests up to the configured limit", () => {
    const config = { windowMs: 1_000, maxRequests: 2, cooldownMs: 5_000 };

    expect(checkRateLimit("127.0.0.1", 0, config).allowed).toBe(true);
    expect(checkRateLimit("127.0.0.1", 100, config).allowed).toBe(true);
  });

  it("blocks requests beyond the configured limit", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 5_000 };

    expect(checkRateLimit("127.0.0.1", 0, config).allowed).toBe(true);
    const blocked = checkRateLimit("127.0.0.1", 100, config);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(5);
  });

  it("resets after the window expires", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 500 };

    expect(checkRateLimit("127.0.0.1", 0, config).allowed).toBe(true);
    // Window expired (1 001 ms) AND cooldown (500 ms) also expired → new bucket.
    expect(checkRateLimit("127.0.0.1", 1_001, config).allowed).toBe(true);
  });

  it("honors cooldown even when it lasts longer than the window", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 5_000 };

    expect(checkRateLimit("127.0.0.1", 0, config).allowed).toBe(true);
    expect(checkRateLimit("127.0.0.1", 100, config).allowed).toBe(false);
    // Window has expired but 5 s cooldown has not → must still be blocked.
    expect(checkRateLimit("127.0.0.1", 1_100, config).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cooldown / bucket-reset security tests
// ---------------------------------------------------------------------------

describe("cooldown reset bypass prevention", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("blocked buckets cannot be reset early by window expiry", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 5_000 };

    checkRateLimit("10.0.0.1", 0, config);           // allowed  (count = 1)
    checkRateLimit("10.0.0.1", 50, config);           // blocked  (count > max)

    // Rate window expires at t = 1 000, but cooldown runs until t = 5 050.
    // The bucket must NOT be reset just because the window rolled over.
    const atWindowExpiry = checkRateLimit("10.0.0.1", 1_500, config);
    expect(atWindowExpiry.allowed).toBe(false);
  });

  it("cooldown survives multiple rate-window rollovers", () => {
    const config = { windowMs: 500, maxRequests: 1, cooldownMs: 10_000 };

    checkRateLimit("10.0.0.2", 0, config);    // allowed
    checkRateLimit("10.0.0.2", 10, config);   // blocked, cooldown until t = 10 010

    // Three window rollovers later (t = 1 600) — cooldown still active.
    expect(checkRateLimit("10.0.0.2", 1_600, config).allowed).toBe(false);
    // Still blocked at t = 9 999.
    expect(checkRateLimit("10.0.0.2", 9_999, config).allowed).toBe(false);
  });

  it("bucket resets only after BOTH window and cooldown have expired", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 3_000 };

    checkRateLimit("10.0.0.3", 0, config);    // allowed
    checkRateLimit("10.0.0.3", 10, config);   // blocked, cooldown until t = 3 010

    // Window expired, cooldown still active (t = 2 000) → still blocked.
    expect(checkRateLimit("10.0.0.3", 2_000, config).allowed).toBe(false);

    // Both expired (t = 4 000) → bucket resets, request allowed.
    expect(checkRateLimit("10.0.0.3", 4_000, config).allowed).toBe(true);
  });

  it("blocked users receive retryAfterSeconds > 0", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 5_000 };

    checkRateLimit("10.0.0.4", 0, config);
    const result = checkRateLimit("10.0.0.4", 50, config);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Proxy trust / x-forwarded-for security tests
// ---------------------------------------------------------------------------

describe("resolveIdentifier — proxy trust disabled (default)", () => {
  const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  }; // PROXY_TRUSTED is not set

  it("ignores x-forwarded-for and uses server-derived IP", () => {
    const req = makeRequest("1.2.3.4", "5.6.7.8");
    expect(resolveIdentifier(req, env)).toBe("5.6.7.8");
  });

  it("falls back to anonymous when no IP is available and proxy trust is off", () => {
    const req = makeRequest("1.2.3.4"); // no req.ip
    expect(resolveIdentifier(req, env)).toBe("anonymous");
  });

  it("ignores spoofed multi-hop x-forwarded-for chain", () => {
    const req = makeRequest("evil.com, 1.2.3.4, 5.6.7.8", "192.168.1.1");
    expect(resolveIdentifier(req, env)).toBe("192.168.1.1");
  });

  it("ignores valid-looking forwarded IP when trust is disabled", () => {
    const req = makeRequest("203.0.113.42", "10.0.0.1");
    // Must use connection IP, not the forwarded header.
    expect(resolveIdentifier(req, env)).toBe("10.0.0.1");
  });
});

describe("resolveIdentifier — proxy trust enabled", () => {
  const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PROXY_TRUSTED: "true", // Enable proxy trust for these tests.
  };

  it("accepts a valid x-forwarded-for IP", () => {
    const req = makeRequest("203.0.113.42", "10.0.0.1");
    expect(resolveIdentifier(req, env)).toBe("203.0.113.42");
  });

  it("uses the leftmost IP in a multi-hop chain", () => {
    const req = makeRequest("203.0.113.1, 10.0.0.2, 10.0.0.3", "10.0.0.4");
    expect(resolveIdentifier(req, env)).toBe("203.0.113.1");
  });

  it("falls back to connection IP when x-forwarded-for is malformed", () => {
    const req = makeRequest("not-an-ip", "10.0.0.5");
    expect(resolveIdentifier(req, env)).toBe("10.0.0.5");
  });

  it("falls back to connection IP when x-forwarded-for contains a hostname", () => {
    const req = makeRequest("evil.example.com, 1.2.3.4", "10.0.0.6");
    // Hostname in leftmost slot → invalid → fall back to connection IP.
    expect(resolveIdentifier(req, env)).toBe("10.0.0.6");
  });

  it("falls back to anonymous when both header and connection IP are absent", () => {
    const req = makeRequest(null); // no forwarded header, no req.ip
    expect(resolveIdentifier(req, env)).toBe("anonymous");
  });

  it("handles IPv6 addresses in x-forwarded-for", () => {
    const req = makeRequest("2001:db8::1", "10.0.0.7");
    expect(resolveIdentifier(req, env)).toBe("2001:db8::1");
  });

  it("trims whitespace from forwarded IP values", () => {
    const req = makeRequest("  203.0.113.99  ", "10.0.0.8");
    expect(resolveIdentifier(req, env)).toBe("203.0.113.99");
  });
});