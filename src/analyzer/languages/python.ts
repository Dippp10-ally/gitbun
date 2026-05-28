import { LanguageProfile } from "./base";

export const pythonProfile: LanguageProfile = {
    name: "python",

    extensions: [".py"],

    configFiles: [
        "pyproject.toml",
        "requirements.txt",
        "setup.py",
    ],

    detectScope(path: string) {
        const parts = path.split("/");

        if (parts.includes("tests")) {
            return "tests";
        }

        return parts[parts.length - 2] || "core";
    },

    classifyType(path: string) {
        const fileName =
            path.split("/").pop() || path;

        if (
            path.includes("/tests/") ||
            fileName.startsWith("test_") ||
            fileName.endsWith("_test.py")
        ) {
            return "test";
        }

        if (
            path.includes("requirements") ||
            path.includes("pyproject")
        ) {
            return "build";
        }

        return "feat";
    },

    summarize(path: string) {
        return `update ${path.split("/").pop()}`;
    },
};