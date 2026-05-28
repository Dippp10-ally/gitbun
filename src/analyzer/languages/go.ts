import { LanguageProfile } from "./base";

export const goProfile: LanguageProfile = {
    name: "go",

    extensions: [".go"],

    configFiles: ["go.mod"],

    detectScope(path: string) {
        const parts = path.split("/");

        if (parts.includes("internal")) {
            return (
                parts[parts.indexOf("internal") + 1] ||
                "internal"
            );
        }

        if (parts.includes("pkg")) {
            return (
                parts[parts.indexOf("pkg") + 1] ||
                "pkg"
            );
        }

        return parts[parts.length - 2] || "core";
    },

    classifyType(path: string) {
        if (path.includes("_test.go")) {
            return "test";
        }

        if (path.includes("go.mod")) {
            return "build";
        }

        return "feat";
    },

    summarize(path: string) {
        return `update ${path.split("/").pop()}`;
    },
};