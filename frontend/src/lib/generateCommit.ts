import { callGemini, GenerateApiError } from "./gemini";
import { ruleBasedCommit } from "./ruleBased";
import type { CommitResult } from "./ruleBased";

export type Mode = "ai" | "rule-based";

export async function generateCommit(diff: string, mode: Mode): Promise<CommitResult> {
  if (!diff.trim()) {
    throw new Error("Diff cannot be empty");
  }

  if (mode === "rule-based") {
    return ruleBasedCommit(diff);
  }

  try {
    return await callGemini(diff);
  } catch (error) {
    if (shouldFallbackToRuleBased(error)) {
      return ruleBasedCommit(diff);
    }

    throw error;
  }
}

export type { CommitResult };

function shouldFallbackToRuleBased(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  return error instanceof GenerateApiError
    && ["AI_UNAVAILABLE", "CONFIGURATION_ERROR", "INVALID_RESPONSE"].includes(error.code);
}
