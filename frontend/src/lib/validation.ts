import { z } from "zod";
import { MAX_PROMPT_LENGTH } from "./sanitizePrompt";

export const commitResultSchema = z.object({
  type: z.enum(["feat", "fix", "docs", "test", "refactor", "chore"]).catch("feat"),
  scope: z.string().trim().min(1).max(40).nullable().catch(null),
  subject: z.string().trim().min(1).max(72).catch("update codebase"),
  body: z.array(z.string().trim().min(1).max(180)).max(5).catch([]),
  confidence: z.number().min(0).max(100).catch(80),
});

export const generateRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required").max(MAX_PROMPT_LENGTH, `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer`),
  metadata: z.object({
    mode: z.string().max(40).optional(),
    source: z.string().max(80).optional(),
  }).strict().optional(),
}).strict();

export const generateSuccessResponseSchema = z.object({
  ok: z.literal(true),
  result: commitResultSchema,
});

export const generateErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const generateApiResponseSchema = z.discriminatedUnion("ok", [
  generateSuccessResponseSchema,
  generateErrorResponseSchema,
]);

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateApiResponse = z.infer<typeof generateApiResponseSchema>;
export type ValidatedCommitResult = z.infer<typeof commitResultSchema>;
