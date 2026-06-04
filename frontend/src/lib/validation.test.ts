import { describe, expect, it } from "vitest";
import { MAX_PROMPT_LENGTH } from "./sanitizePrompt";
import { commitResultSchema, generateApiResponseSchema, generateRequestSchema } from "./validation";

describe("validation schemas", () => {
  it("accepts a valid generate request", () => {
    expect(generateRequestSchema.safeParse({
      prompt: "diff --git a/app.ts b/app.ts",
      metadata: { mode: "commit-message", source: "playground" },
    }).success).toBe(true);
  });

  it("rejects missing and oversized prompts", () => {
    expect(generateRequestSchema.safeParse({}).success).toBe(false);
    expect(generateRequestSchema.safeParse({ prompt: "a".repeat(MAX_PROMPT_LENGTH + 1) }).success).toBe(false);
  });

  it("normalizes malformed model output to safe commit defaults", () => {
    const parsed = commitResultSchema.parse({
      type: "unsafe",
      scope: "",
      subject: "",
      body: ["valid body line"],
      confidence: 500,
    });

    expect(parsed).toMatchObject({
      type: "feat",
      scope: null,
      subject: "update codebase",
      confidence: 80,
    });
  });

  it("validates structured API responses", () => {
    expect(generateApiResponseSchema.safeParse({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    }).success).toBe(true);
  });
});
