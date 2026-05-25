export const MAX_PROMPT_LENGTH = 20_000;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EXCESSIVE_BLANK_LINES = /\n{3,}/g;
const EXCESSIVE_SPACES = /[ \t]{3,}/g;

const INSTRUCTION_OVERRIDE_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /reveal\s+(the\s+)?(hidden|system|developer)\s+(prompt|instructions?)/gi,
  /show\s+(me\s+)?(the\s+)?(system|developer)\s+(prompt|instructions?)/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
  /you\s+are\s+now\s+(in|running|acting\s+as)/gi,
  /repeat\s+this\s+instruction\s+(forever|recursively|again\s+and\s+again)/gi,
];

export function sanitizePrompt(input: string, maxLength = MAX_PROMPT_LENGTH): string {
  let sanitized = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS, "")
    .replace(EXCESSIVE_SPACES, " ")
    .replace(EXCESSIVE_BLANK_LINES, "\n\n")
    .trim();

  for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[filtered instruction override]");
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trimEnd();
  }

  return sanitized;
}

export function formatUntrustedPromptBlock(prompt: string): string {
  return JSON.stringify(sanitizePrompt(prompt));
}
