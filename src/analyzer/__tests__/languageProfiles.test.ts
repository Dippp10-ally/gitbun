import {
    describe,
    test,
    expect,
} from "vitest";

import { detectScope } from "../scopeDetector";

describe("language profiles", () => {
    test("detects python scope", () => {
        expect(
            detectScope([
                "src/auth/login.py",
            ])
        ).toBe("auth");
    });

    test("detects go internal scope", () => {
        expect(
            detectScope([
                "internal/cache/redis.go",
            ])
        ).toBe("cache");
    });

    test("detects rust scope", () => {
        expect(
            detectScope([
                "src/parser/tokenizer.rs",
            ])
        ).toBe("parser");
    });
});