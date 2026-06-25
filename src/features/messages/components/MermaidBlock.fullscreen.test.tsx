// @vitest-environment jsdom
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

// mermaid needs DOM measurement and fonts that jsdom cannot provide.
// We replace the render call with a deterministic, instant SVG.
const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="10" height="10"/></g></svg>';
vi.mock("mermaid", () => ({
  default: {
    initialize: () => undefined,
    render: async () => ({ svg: FAKE_SVG, diagramType: "graph" }),
  },
}));

type ViewerMockOptions = {
  shown?: () => void;
  hidden?: () => void;
};

type ViewerMockInstance = {
  show: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const viewerInstances: ViewerMockInstance[] = [];

vi.mock("viewerjs", () => ({
  default: vi.fn().mockImplementation((_element: HTMLElement, options: ViewerMockOptions) => {
    const instance: ViewerMockInstance = {
      show: vi.fn(() => options.shown?.()),
      destroy: vi.fn(),
      update: vi.fn(),
    };
    viewerInstances.push(instance);
    return instance;
  }),
}));

import MermaidBlock from "./MermaidBlock";
import {
  MermaidFullscreenViewer,
  destroyActiveViewer,
  getActiveViewer,
} from "../../markdown/mermaidFullscreen";

afterEach(() => {
  destroyActiveViewer();
  viewerInstances.length = 0;
});

async function waitForEnabledFullscreenButton(container: HTMLElement) {
  return await waitFor(() => {
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="mermaid-fullscreen-button"]',
    );
    if (!button) {
      throw new Error("Mermaid fullscreen button was not rendered");
    }
    expect(button.disabled).toBe(false);
    return button;
  });
}

describe("MermaidBlock fullscreen entry", () => {
  it("renders a disabled fullscreen button before render", () => {
    const { container } = render(
      <MermaidBlock value="graph LR; A-->B;" copyUseModifier={false} />,
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="mermaid-fullscreen-button"]',
    );
    expect(button).toBeTruthy();
    expect(button?.disabled).toBe(true);
  });

  it("enables the fullscreen button after the mocked SVG is ready", async () => {
    const { container } = render(
      <MermaidBlock value="graph LR; A-->B;" copyUseModifier={false} />,
    );
    const button = await waitForEnabledFullscreenButton(container);
    expect(button?.getAttribute("aria-label")).toBe("Open diagram fullscreen");
  });

  it("clicking the button opens a portal <img>", async () => {
    const { container } = render(
      <MermaidBlock value="graph LR; A-->B;" copyUseModifier={false} />,
    );
    const button = await waitForEnabledFullscreenButton(container);
    fireEvent.click(button);
    await waitFor(() => {
      expect(
        document.body.querySelector('[data-testid="mermaid-fullscreen-img"]'),
      ).toBeTruthy();
    });
  });

  it("does not leak DOM nodes when the parent unmounts with the viewer open", async () => {
    const { container, unmount } = render(
      <MermaidBlock value="graph LR; A-->B;" copyUseModifier={false} />,
    );
    const button = await waitForEnabledFullscreenButton(container);
    fireEvent.click(button);
    await waitFor(() => {
      expect(
        document.body.querySelector('[data-testid="mermaid-fullscreen-img"]'),
      ).toBeTruthy();
    });
    unmount();
    await waitFor(() => {
      expect(
        document.body.querySelector('[data-testid="mermaid-fullscreen-img"]'),
      ).toBeNull();
    });
  });

  it("tolerates React 18 StrictMode double mount", async () => {
    await act(async () => {
      render(
        <StrictMode>
          <MermaidBlock value="graph LR; A-->B;" copyUseModifier={false} />
        </StrictMode>,
      );
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(
      document.body.querySelectorAll('[data-testid="mermaid-fullscreen-img"]')
        .length,
    ).toBeLessThanOrEqual(0);
  });

  it("does not let an older viewer cleanup clear the newer active viewer", async () => {
    const first = render(
      <MermaidFullscreenViewer open svg={FAKE_SVG} onClose={() => undefined} />,
    );
    await waitFor(() => {
      expect(getActiveViewer()).toBe(viewerInstances[0]);
    });

    render(<MermaidFullscreenViewer open svg={FAKE_SVG} onClose={() => undefined} />);
    await waitFor(() => {
      expect(getActiveViewer()).toBe(viewerInstances[1]);
    });

    first.unmount();
    expect(getActiveViewer()).toBe(viewerInstances[1]);
  });
});
