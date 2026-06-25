// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FileMarkdownPreview } from "./FileMarkdownPreview";

vi.mock("react-markdown", () => ({
  default: ({
    children,
    components,
  }: {
    children: string;
    components: {
      img?: (props: { src: string; alt: string }) => ReactNode;
    };
  }) => {
    const match = String(children).match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (!match || !components.img) {
      return <>{children}</>;
    }
    return <>{components.img({ alt: match[1] ?? "", src: match[2] ?? "" })}</>;
  },
}));

vi.mock("../../markdown/imageFullscreen", () => ({
  ImageFullscreenViewer: ({
    open,
    src,
    workspaceId,
  }: {
    open: boolean;
    src: string;
    workspaceId?: string | null;
  }) => (
    open ? (
      <div
        data-testid="file-image-fullscreen-viewer"
        data-src={src}
        data-workspace-id={workspaceId ?? ""}
      />
    ) : null
  ),
}));

describe("FileMarkdownPreview image fullscreen", () => {
  it("opens the image viewer with workspace context", async () => {
    render(
      <FileMarkdownPreview
        value="![preview](./assets/preview.png)"
        documentKey="preview"
        workspaceId="ws-file"
        sourceFilePath="/repo/docs/report.md"
      />,
    );

    const image = await screen.findByRole("img", { name: "preview" });
    expect(image.getAttribute("src")).toBe("asset://localhost//repo/docs/assets/preview.png");
    fireEvent.click(image);

    await waitFor(() => {
      expect(screen.getByTestId("file-image-fullscreen-viewer").getAttribute("data-src")).toBe(
        "/repo/docs/assets/preview.png",
      );
      expect(
        screen.getByTestId("file-image-fullscreen-viewer").getAttribute("data-workspace-id"),
      ).toBe("ws-file");
    });
  });
});
