import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rateLimit";

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
    expect(checkRateLimit("127.0.0.1", 1_001, config).allowed).toBe(true);
  });

  it("honors cooldown even when it lasts longer than the window", () => {
    const config = { windowMs: 1_000, maxRequests: 1, cooldownMs: 5_000 };

    expect(checkRateLimit("127.0.0.1", 0, config).allowed).toBe(true);
    expect(checkRateLimit("127.0.0.1", 100, config).allowed).toBe(false);
    expect(checkRateLimit("127.0.0.1", 1_100, config).allowed).toBe(false);
  });
});
