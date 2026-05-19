// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolCallBlock } from "./ToolCallBlock";

const findRawPayload =
  "<invoke name=\"find\"><parameter name=\"path\">/repo</parameter></invoke>";
const streamingRawPayload = "<function_calls><invoke name=\"bash\">";

describe("ToolCallBlock", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders collapsed by default with tool name and preview", () => {
    render(
      <ToolCallBlock
        raw={findRawPayload}
        tool="find"
        params={[{ name: "path", value: "/repo" }]}
        complete
      />,
    );

    expect(screen.getByRole("group", { name: "messages.toolCallCard.title" })).toBeTruthy();
    expect(screen.getByText("find")).toBeTruthy();
    expect(screen.getByText("/repo")).toBeTruthy();
    expect(screen.queryByText("messages.toolCallCard.rawPayload")).toBeNull();
  });

  it("expands to reveal parameters and raw payload", () => {
    const raw = "<invoke name=\"find\"><parameter name=\"path\">/repo</parameter></invoke>";
    render(
      <ToolCallBlock
        raw={raw}
        tool="find"
        params={[{ name: "path", value: "/repo" }]}
        complete
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "messages.toolCallCard.expand" }));

    expect(screen.getByText("messages.toolCallCard.parameters")).toBeTruthy();
    expect(screen.getByText("path")).toBeTruthy();
    expect(screen.getByText(raw)).toBeTruthy();
  });

  it("copies raw payload and shows confirmation", async () => {
    vi.useFakeTimers();
    const raw = "<invoke name=\"find\"></invoke>";
    render(<ToolCallBlock raw={raw} tool="find" complete />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "messages.toolCallCard.copy" }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(raw);
    expect(screen.getByRole("button", { name: "messages.toolCallCard.copied" })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(screen.getByRole("button", { name: "messages.toolCallCard.copy" })).toBeTruthy();
  });

  it("shows streaming indicator when incomplete", () => {
    render(
      <ToolCallBlock
        raw={streamingRawPayload}
        tool="bash"
        complete={false}
      />,
    );

    expect(screen.getByText("messages.toolCallCard.streaming")).toBeTruthy();
  });

  it("uses unknown-tool and no-parameters fallbacks", () => {
    render(<ToolCallBlock raw="<invoke></invoke>" complete />);

    expect(screen.getByText("messages.toolCallCard.unknownTool")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "messages.toolCallCard.expand" }));
    expect(screen.getByText("messages.toolCallCard.noParams")).toBeTruthy();
  });
});
