import { scanDiff } from "./diffScanner";
import { getLanguageProfile } from "./languageAnalyzer";

type FileInfo = {
  path: string;
  additions: number;
  deletions: number;
  status: "A" | "M" | "D";
};

function classifyFileType(
  file: string
): string | null {
  const profile = getLanguageProfile(file);

  if (profile) {
    return profile.classifyType(file);
  }

  if (
    file.endsWith(".md") ||
    file.toLowerCase().includes("docs")
  ) {
    return "docs";
  }

  if (
    file.includes("/tests/") ||
    file.endsWith(".test.ts") ||
    file.endsWith(".spec.ts")
  ) {
    return "test";
  }

  return "chore";
}

export async function classifyCommitType(
  files: FileInfo[]
): Promise<string> {
  const score: Record<string, number> = {
    feat: 0,
    fix: 0,
    refactor: 0,
    docs: 0,
    test: 0,
    chore: 0,
    build: 0,
    ci: 0,
    style: 0,
    perf: 0,
  };

  const deletedFiles = files.filter(
    f => f.status === "D"
  ).length;

  const addedFiles = files.filter(
    f => f.status === "A"
  ).length;

  if (deletedFiles > 0 && addedFiles === 0) {
    score.refactor += 3;
  }

  if (addedFiles > 0 && deletedFiles === 0) {
    score.feat += 2;
  }

  let totalAdd = 0;
  let totalDel = 0;

  for (const file of files) {
    totalAdd += file.additions;
    totalDel += file.deletions;

    const type = classifyFileType(file.path);

    if (type) {
      score[type] =
        (score[type] || 0) + 3;
    }

    if (
      file.path.includes(
        ".github/workflows"
      )
    ) {
      score.ci += 3;
    }

    if (
      file.path.includes("package.json") ||
      file.path.includes("go.mod") ||
      file.path.includes("Cargo.toml") ||
      file.path.includes("pyproject.toml")
    ) {
      score.build += 2;
    }
  }

  const diffSignals = await scanDiff();

  if (diffSignals.hasNewFunction) {
    score.feat += 2;
  }

  if (diffSignals.hasRemovedCode) {
    score.refactor += 2;
  }

  if (diffSignals.hasBugFix) {
    score.fix += 3;
  }

  if (diffSignals.hasRefactor) {
    score.refactor += 2;
  }

  if (diffSignals.hasOptimization) {
    score.perf += 3;
  }

  const diffBalance = Math.abs(
    totalAdd - totalDel
  );

  if (
    totalAdd > totalDel &&
    totalAdd > 5
  ) {
    score.feat += 2;
  }

  if (
    diffBalance < 10 &&
    totalAdd > 5 &&
    totalDel > 5
  ) {
    score.refactor += 3;
  }

  if (totalDel > totalAdd) {
    score.fix += 2;
  }

  const sorted = Object.entries(score)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  return sorted.length
    ? sorted[0][0]
    : "chore";
}