import type { CommitResult } from "./ruleBased";
import { generateApiResponseSchema } from "./validation";

export class GenerateApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GenerateApiError";
  }
}

export async function callGemini(diff: string): Promise<CommitResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: diff,
      metadata: { mode: "commit-message", source: "playground" },
    }),
  });

  const payload = generateApiResponseSchema.safeParse(await response.json().catch(() => null));

  if (!payload.success) {
    throw new GenerateApiError("AI generation returned an invalid response", "INVALID_RESPONSE", response.status);
  }

  if (!payload.data.ok) {
    throw new GenerateApiError(payload.data.error.message, payload.data.error.code, response.status);
  }

  return payload.data.result;
}
