import { LanguageProfile } from "./base";

export const rustProfile: LanguageProfile = {
    name: "rust",

    extensions: [".rs"],

    configFiles: ["Cargo.toml"],

    detectScope(path: string) {
        const parts = path.split("/");

        if (parts.includes("src")) {
            return (
                parts[parts.indexOf("src") + 1] ||
                "core"
            );
        }

        return parts[parts.length - 2] || "core";
    },

    classifyType(path: string) {
        if (path.includes("tests")) {
            return "test";
        }

        if (path.includes("Cargo.toml")) {
            return "build";
        }

        return "feat";
    },

    summarize(path: string) {
        return `update ${path.split("/").pop()}`;
    },
};