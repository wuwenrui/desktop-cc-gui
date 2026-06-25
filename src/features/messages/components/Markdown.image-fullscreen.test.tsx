// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

vi.mock("./FullMarkdownRuntime", () => ({
  FullMarkdownRuntime: ({
    value,
    components,
  }: {
    value: string;
    components: {
      img?: (props: { src: string; alt: string }) => ReactNode;
    };
  }) => {
    const match = value.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (!match || !components.img) {
      return <>{value}</>;
    }
    return <>{components.img({ alt: match[1] ?? "", src: match[2] ?? "" })}</>;
  },
}));

vi.mock("../../markdown/imageFullscreen", () => ({
  ImageFullscreenViewer: ({
    open,
    src,
  }: {
    open: boolean;
    src: string;
  }) => (open ? <div data-testid="image-fullscreen-viewer" data-src={src} /> : null),
}));

describe("Markdown image fullscreen", () => {
  it("opens the image viewer from a rendered markdown image", async () => {
    render(<Markdown value="![diagram](https://example.com/diagram.png)" />);

    const image = await screen.findByRole("img", { name: "diagram" });
    fireEvent.click(image);

    await waitFor(() => {
      expect(screen.getByTestId("image-fullscreen-viewer").getAttribute("data-src")).toBe(
        "https://example.com/diagram.png",
      );
    });
  });
});
