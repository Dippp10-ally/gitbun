// src/analyzer/summarizer.ts
import { SemanticEvent } from "./semanticTypes";
import type { DeduplicatedResult } from "./fileDeduplicator";
import type { FileChange } from "./fileFilter";

// ========== 1. Original simple diff summarizer ==========
export function generateSummary(files: FileChange[]): string {
  const summaries = files.map((file) => {
    return `${file.path} (+${file.additions} -${file.deletions})`;
  });
  return summaries.join("\n");
}

// ========== 2. Deduplicated summary (contributed by Swathi) ==========
export function generateSummaryFromResult(result: DeduplicatedResult): string {
  const groupSummaries = result.groups.map((group) => {
    const { representative } = group;
    return `${group.label} (${group.count} files, +${representative.additions} -${representative.deletions})`;
  });
  const singleSummaries = result.singles.map((file) => {
    return `${file.path} (+${file.additions} -${file.deletions})`;
  });
  return [...groupSummaries, ...singleSummaries].join("\n");
}

// ========== 3. Conventional Commit generator (with semantic events) ==========
export interface FileInfo {
  path: string;
  additions: number;
  deletions: number;
  status: "A" | "M" | "D";
}

function detectType(files: FileInfo[]): string {
  let hasNewCode = false;
  let hasTest = false;
  let hasFix = false;
  let hasDoc = false;
  let hasConfig = false;
  let hasDeletionsOnly = true;

  for (const file of files) {
    const path = file.path.toLowerCase();
    if (file.status === "A" && /\.(ts|js|jsx|tsx)$/.test(path)) {
      hasNewCode = true;
    }
    if (path.includes("test") || path.includes("spec")) hasTest = true;
    if (path.includes("fix") || path.includes("bug") || path.includes("hotfix"))
      hasFix = true;
    if (path.endsWith(".md") || path.includes("docs")) hasDoc = true;
    if (/\.(json|ya?ml|toml)$/.test(path)) hasConfig = true;
    // Only mark as NOT deletions-only if there is an addition
    if (file.additions > 0) {
      hasDeletionsOnly = false;
    }
  }

  if (hasTest) return "test";
  if (hasFix) return "fix";
  if (hasNewCode) return "feat";
  if (hasDoc) return "docs";
  if (hasConfig || hasDeletionsOnly) return "chore";
  return "refactor";
}

function detectScope(files: FileInfo[]): string {
  const scopes: string[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    if (parts.length > 1) {
      scopes.push(parts[0]);
    } else {
      scopes.push(parts[0].split(".")[0]);
    }
  }
  const freq: Record<string, number> = {};
  for (const s of scopes) freq[s] = (freq[s] || 0) + 1;
  let maxScope = scopes[0] || "general";
  let maxCount = 0;
  for (const [s, count] of Object.entries(freq)) {
    if (count > maxCount) {
      maxCount = count;
      maxScope = s;
    }
  }
  return maxScope;
}

function generateSubject(files: FileInfo[]): string {
  const addedFiles = files.filter(
    (f) => f.status === "A" && /\.(ts|tsx|js|jsx)$/.test(f.path),
  );
  const modifiedFiles = files.filter((f) => f.status === "M");
  if (addedFiles.length > 0) {
    const name =
      addedFiles[0].path.split("/").pop()?.split(".")[0] || "component";
    return `add ${name}`;
  } else if (modifiedFiles.length > 0) {
    const name =
      modifiedFiles[0].path.split("/").pop()?.split(".")[0] || "code";
    return `update ${name}`;
  }
  return "update files";
}

function enhanceWithSemanticEvents(
  subject: string,
  events: SemanticEvent[],
): string {
  if (events.length === 0) return subject;
  const priority: Record<string, number> = {
    function_rename: 1,
    api_signature_change: 2,
    interface_change: 3,
    logic_extraction: 4,
    logic_movement: 5,
  };
  // Sort a copy to avoid mutating the original array
  const sortedEvents = [...events].sort(
    (a, b) => (priority[a.type] || 99) - (priority[b.type] || 99),
  );
  const main = sortedEvents[0];
  switch (main.type) {
    case "function_rename": {
      const details = main.details as { oldName: string; newName: string };
      return `rename ${details.oldName} to ${details.newName}`;
    }
    case "api_signature_change": {
      const details = main.details as { changes: string[] };
      return `update ${main.entityName} signature (${details.changes.join(", ")})`;
    }
    case "interface_change": {
      const props = main.details as { added?: string[]; removed?: string[] };
      if (props.added && props.added.length) {
        return `add ${props.added.join(", ")} to ${main.entityName} interface`;
      }
      if (props.removed && props.removed.length) {
        return `remove ${props.removed.join(", ")} from ${main.entityName} interface`;
      }
      return `modify ${main.entityName} interface`;
    }
    default:
      return subject;
  }
}

/**
 * Generates a Conventional Commit message (e.g., "feat(scope): add something").
 * This is the main entry point for the commit generator.
 */
export function generateConventionalCommitMessage(
  files: FileInfo[],
  semanticEvents?: SemanticEvent[],
): string {
  const type = detectType(files);
  const scope = detectScope(files);
  let subject = generateSubject(files);
  if (semanticEvents && semanticEvents.length > 0) {
    subject = enhanceWithSemanticEvents(subject, semanticEvents);
  }
  subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  if (subject.endsWith(".")) subject = subject.slice(0, -1);
  return `${type}(${scope}): ${subject}`;
}
