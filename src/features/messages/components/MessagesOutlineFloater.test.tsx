// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";
import { MessagesOutlineFloater } from "./MessagesOutlineFloater";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../styles/featureStyleLoaders", () => ({
  loadMessagesOutlineFloaterStyles: vi.fn(),
}));

const outline: MarkdownOutlineEntry[] = [
  {
    id: "intro",
    anchor: "intro",
    title: "Intro",
    depth: 1,
    startLine: 1,
    endLine: 1,
    ordinal: 1,
  },
  {
    id: "details",
    anchor: "details",
    title: "Details",
    depth: 2,
    startLine: 4,
    endLine: 4,
    ordinal: 2,
  },
];

describe("MessagesOutlineFloater", () => {
  it("does not render for empty outline", () => {
    const { container } = render(
      <MessagesOutlineFloater outline={[]} activeHeadingId={null} onJumpToHeading={vi.fn()} />,
    );

    expect(container.querySelector(".messages-outline-floater")).toBeNull();
  });

  it("expands, highlights active heading, and forwards jump requests", () => {
    const onJumpToHeading = vi.fn();
    render(
      <MessagesOutlineFloater
        outline={outline}
        activeHeadingId="details"
        onJumpToHeading={onJumpToHeading}
      />,
    );

    fireEvent.click(screen.getByTestId("messages-outline-floater-entry"));

    const rows = screen.getAllByTestId("messages-outline-floater-row");
    expect(rows[1].className).toContain("is-active");

    fireEvent.click(rows[1]);
    expect(onJumpToHeading).toHaveBeenCalledWith("details");
  });

  it("resets pinned state when outline identity changes", () => {
    const { rerender } = render(
      <MessagesOutlineFloater
        outline={outline}
        activeHeadingId={null}
        onJumpToHeading={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("messages-outline-floater-entry"));
    fireEvent.click(screen.getByLabelText("messages.outlinePin"));

    rerender(
      <MessagesOutlineFloater
        outline={[
          {
            id: "next",
            anchor: "next",
            title: "Next",
            depth: 1,
            startLine: 1,
            endLine: 1,
            ordinal: 1,
          },
        ]}
        activeHeadingId={null}
        onJumpToHeading={vi.fn()}
      />,
    );

    expect(screen.getByTestId("messages-outline-floater-entry")).toBeTruthy();
  });
});
