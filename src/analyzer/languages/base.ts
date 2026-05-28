export interface LanguageProfile {
    name: string;

    extensions: string[];

    configFiles?: string[];

    detectScope(path: string): string | null;

    classifyType(path: string): string | null;

    summarize(path: string): string | null;
}