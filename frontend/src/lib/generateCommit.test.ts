import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCommit } from "./generateCommit";

describe("generateCommit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to rule-based generation when AI fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed to fetch")));

    const result = await generateCommit("diff --git a/src/app.ts b/src/app.ts\n+export const value = 1;", "ai");

    expect(result.subject).toBe("feat changes in app");
    expect(result.confidence).toBe(60);
  });

  it("keeps validation and rate limit errors visible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 429,
      json: () => Promise.resolve({
        ok: false,
        error: { code: "RATE_LIMITED", message: "Too many generation requests" },
      }),
    }));

    await expect(generateCommit("diff --git a/src/app.ts b/src/app.ts", "ai"))
      .rejects.toThrow("Too many generation requests");
  });
});
