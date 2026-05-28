import { beforeEach, describe, expect, it, vi } from "vitest";
import { enhanceCommit } from "./ollamaEnhancer";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("node-fetch", () => ({
  default: fetchMock,
}));

describe("enhanceCommit", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      json: async () => ({
        message: {
          content: "feat(core): add test coverage",
        },
      }),
    });
  });

  it("appends custom prompt instructions when configured", async () => {
    await enhanceCommit("feat(core): test", "summary", "llama3", {
      customPrompt: "Always include [PROJ-123].",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toContain("User Custom Instructions:");
    expect(body.messages[0].content).toContain("Always include [PROJ-123].");
  });

  it("uses the base prompt when customPrompt is absent", async () => {
    await enhanceCommit("feat(core): test", "summary", "llama3", {});

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].content).not.toContain("User Custom Instructions:");
    expect(body.messages[0].content).toContain(
      "You are a senior developer who writes perfect conventional commits."
    );
  });
});
