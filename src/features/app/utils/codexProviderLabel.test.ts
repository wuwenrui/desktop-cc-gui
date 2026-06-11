import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import { resolveCodexProviderLabel } from "./codexProviderLabel";

const codexThread: ThreadSummary = {
  id: "codex:session-1",
  name: "Codex Session",
  updatedAt: 1,
  engineSource: "codex",
};

describe("resolveCodexProviderLabel", () => {
  it("prefers provider name then source label", () => {
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileName: "OpenAI",
        sourceLabel: "custom/openai",
      }),
    ).toBe("OpenAI");
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileName: " ",
        sourceLabel: "custom/openai",
      }),
    ).toBe("custom/openai");
  });

  it("uses managed provider id as fallback but hides disk and empty bindings", () => {
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileId: "provider-a",
      }),
    ).toBe("provider-a");
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileId: "__disk__",
      }),
    ).toBeNull();
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        providerProfileId: " ",
        providerProfileName: " ",
        sourceLabel: " ",
      }),
    ).toBeNull();
  });

  it("does not render labels for non-Codex threads", () => {
    expect(
      resolveCodexProviderLabel({
        ...codexThread,
        engineSource: "claude",
        sourceLabel: "custom/openai",
      }),
    ).toBeNull();
  });
});
