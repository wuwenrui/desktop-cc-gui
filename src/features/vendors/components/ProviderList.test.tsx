// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../types";
import {
  buildClaudeProviderReorderIds,
  ProviderList,
} from "./ProviderList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function provider(
  id: string,
  options: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    ...options,
  };
}

describe("buildClaudeProviderReorderIds", () => {
  it("reorders non-active providers and inserts active at its home index", () => {
    const providers = [
      provider("a"),
      provider("b", { isActive: true }),
      provider("c"),
    ];

    expect(buildClaudeProviderReorderIds(providers, 1, 0)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("reorders all regular providers when no active provider exists", () => {
    const providers = [provider("a"), provider("b"), provider("c")];

    expect(buildClaudeProviderReorderIds(providers, 0, 2)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("ProviderList", () => {
  it("renders local and active providers outside the draggable list", () => {
    const { container } = render(
      <ProviderList
        providers={[
          provider("__local_settings__", {
            isActive: false,
            isLocalProvider: true,
          }),
          provider("a"),
          provider("b", { isActive: true }),
          provider("c"),
        ]}
        loading={false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSwitch={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    const cardNames = Array.from(
      container.querySelectorAll(".vendor-card-name"),
    ).map((element) => element.textContent);

    expect(cardNames).toEqual([
      "settings.vendor.localProviderName",
      "Provider B",
      "Provider A",
      "Provider C",
    ]);
    expect(
      container.querySelectorAll("[title='settings.vendor.dragToReorder']"),
    ).toHaveLength(2);
  });
});
