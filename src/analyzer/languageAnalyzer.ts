import path from "path";
import { languageProfiles } from "./languages";

export function detectLanguage(
  paths: string[]
): string {
  const extensions = paths
    .map(p =>
      p.split(".").pop()?.toLowerCase()
    )
    .filter(Boolean);

  const counts: Record<string, number> = {};

  for (const ext of extensions) {
    counts[ext!] = (counts[ext!] || 0) + 1;
  }

  const dominant = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const map: Record<string, string> = {
    ts: "typescript",
    js: "javascript",
    py: "python",
    java: "java",
    go: "go",
    rs: "rust",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    kt: "kotlin",
    swift: "swift",
    scala: "scala",
    dart: "dart",
    sh: "shell",
  };

  return map[dominant || ""] || "generic";
}

export function getLanguageProfile(
  file: string
) {
  const ext = path.extname(file);

  const base = path.basename(file);

  return languageProfiles.find(profile =>
    profile.extensions.includes(ext) ||
    profile.configFiles?.includes(base)
  );
}