// @vitest-environment jsdom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="10" height="10"/></g></svg>';

vi.mock("mermaid", () => ({
  default: {
    initialize: () => undefined,
    render: async () => ({ svg: FAKE_SVG, diagramType: "graph" }),
  },
}));

import {
  FileMarkdownPreview,
  clearFileMarkdownPreviewRuntimeCachesForTests,
} from "./FileMarkdownPreview";

const t = (key: string) => {
  const dict: Record<string, string> = {
    "files.markdownMermaidSource": "Source",
    "files.markdownMermaidRender": "Render",
    "files.markdownMermaidTabList": "Mermaid",
    "files.markdownMermaidRendering": "Rendering",
    "files.markdownMermaidRenderFailed": "Failed: {{message}}",
    "common.markdownMermaidFullscreen": "Fullscreen",
    "common.markdownMermaidFullscreenHint": "Open diagram fullscreen",
  };
  return dict[key] ?? key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

function renderPreview(value: string) {
  clearFileMarkdownPreviewRuntimeCachesForTests();
  return render(<FileMarkdownPreview value={value} documentKey="test-doc" />);
}

describe("FileMarkdownMermaidBlock fullscreen entry", () => {
  it("disables the fullscreen button in Source tab", async () => {
    const { container } = renderPreview("```mermaid\ngraph LR; A-->B;\n```");
    const button = await waitFor(() =>
      container.querySelector<HTMLButtonElement>(
        '[data-testid="file-markdown-mermaid-fullscreen-button"]',
      ),
    );
    expect(button?.disabled).toBe(true);
  });

  it("enables the fullscreen button in Render tab after the SVG is ready", async () => {
    const { container } = renderPreview("```mermaid\ngraph LR; A-->B;\n```");
    const renderTab = container.querySelector<HTMLButtonElement>(
      '.fvp-file-markdown-mermaid-tab[role="tab"]:nth-of-type(2)',
    );
    if (renderTab) fireEvent.click(renderTab);
    const button = await waitFor(
      () =>
        container.querySelector<HTMLButtonElement>(
          '[data-testid="file-markdown-mermaid-fullscreen-button"]',
        ),
      { timeout: 5000 },
    );
    await waitFor(() => expect(button!.disabled).toBe(false), { timeout: 5000 });
  });

  it("clicking the fullscreen button mounts a portal <img>", async () => {
    const { container } = renderPreview("```mermaid\ngraph LR; A-->B;\n```");
    const renderTab = container.querySelector<HTMLButtonElement>(
      '.fvp-file-markdown-mermaid-tab[role="tab"]:nth-of-type(2)',
    );
    if (renderTab) fireEvent.click(renderTab);
    const button = await waitFor(
      () =>
        container.querySelector<HTMLButtonElement>(
          '[data-testid="file-markdown-mermaid-fullscreen-button"]',
        ),
      { timeout: 5000 },
    );
    await waitFor(() => expect(button!.disabled).toBe(false), { timeout: 5000 });
    fireEvent.click(button!);
    await waitFor(() => {
      expect(
        document.body.querySelector(
          '[data-testid="mermaid-fullscreen-img"]',
        ),
      ).toBeTruthy();
    });
  });
});
