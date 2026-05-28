import { LanguageProfile } from "./base";

export const javascriptProfile: LanguageProfile = {
    name: "javascript",

    extensions: [".js", ".ts", ".jsx", ".tsx"],

    configFiles: [
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "next.config.ts",
    ],

    detectScope(path: string) {
        const parts = path.split("/");

        if (parts.includes("components")) {
            return "components";
        }

        if (parts.includes("pages")) {
            return "pages";
        }

        if (parts.includes("api")) {
            return "api";
        }

        if (parts.includes("src")) {
            return parts[parts.indexOf("src") + 1] || "core";
        }

        return parts[parts.length - 2] || "core";
    },

    classifyType(path: string) {
        if (
            path.includes("test") ||
            path.includes("__tests__") ||
            path.endsWith(".spec.ts") ||
            path.endsWith(".test.ts") ||
            path.endsWith(".test.js")
        ) {
            return "test";
        }

        if (
            path.includes("docs") ||
            path.endsWith(".md")
        ) {
            return "docs";
        }

        if (
            path.includes("package.json") ||
            path.includes("tsconfig") ||
            path.includes("vite.config")
        ) {
            return "build";
        }

        return "feat";
    },

    summarize(path: string) {
        return `update ${path.split("/").pop()}`;
    },
};