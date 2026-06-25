// @vitest-environment jsdom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const t = (key: string) => {
  const dict: Record<string, string> = {
    "messages.copyCodeBlock": "Copy",
    "messages.copy": "Copy",
    "messages.copied": "Copied",
    "messages.copyWithFence": "Copy with fence",
    "messages.copyCodeBlockWithFence": "Copy with fence",
    "common.markdownMermaidFullscreen": "Fullscreen",
    "common.markdownMermaidFullscreenHint": "Open diagram fullscreen",
  };
  return dict[key] ?? key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="10" height="10"/></g></svg>';
vi.mock("mermaid", () => ({
  default: {
    initialize: () => undefined,
    render: async () => ({ svg: FAKE_SVG, diagramType: "graph" }),
  },
}));

type ViewerStub = {
  element: HTMLElement;
  show: () => void;
  destroy: () => void;
};

const showSpy = vi.fn();
const ctorSpy = vi.fn().mockImplementation(function ViewerMock(
  element: HTMLElement,
): ViewerStub {
  return {
    element,
    show: showSpy,
    destroy: () => undefined,
  };
});

vi.mock("viewerjs", () => ({
  default: ctorSpy,
}));

import MermaidBlock from "./MermaidBlock";

describe("MermaidFullscreenViewer viewerjs contract", () => {
  it("constructs a Viewer and calls show() so the modal actually opens", async () => {
    showSpy.mockClear();
    ctorSpy.mockClear();
    const { container } = render(
      <MermaidBlock value="graph LR; A-->B;" copyUseModifier={false} />,
    );
    const button = await waitFor(() =>
      container.querySelector<HTMLButtonElement>(
        '[data-testid="mermaid-fullscreen-button"]',
      ),
    );
    fireEvent.click(button!);
    await waitFor(() => {
      expect(ctorSpy).toHaveBeenCalledTimes(1);
      expect(showSpy).toHaveBeenCalled();
    });
  });
});
