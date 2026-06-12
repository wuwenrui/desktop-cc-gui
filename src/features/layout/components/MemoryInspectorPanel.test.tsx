// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryInspectorPanel } from "./MemoryInspectorPanel";

const listSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("../../project-memory/services/projectMemoryFacade", () => ({
  projectMemoryFacade: {
    listSummary: listSummaryMock,
  },
}));

describe("MemoryInspectorPanel", () => {
  afterEach(() => {
    cleanup();
    listSummaryMock.mockReset();
  });

  it("renders a read-only memory list from the existing facade", async () => {
    listSummaryMock.mockResolvedValue({
      items: [
        { id: "m1", title: "客户偏好", summary: "客户要求非技术版说明" },
        { id: "m2", title: "团队约定", summary: "" },
      ],
      total: 2,
    });

    render(<MemoryInspectorPanel workspaceId="ws-1" onOpenMemory={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("客户偏好")).toBeTruthy();
    });
    expect(screen.getByText("团队约定")).toBeTruthy();
    expect(screen.getByText("客户要求非技术版说明")).toBeTruthy();
    expect(screen.queryByText("fanbox.memoryPanel.empty")).toBeNull();
    expect(listSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1" }),
    );
  });

  it("renders the empty state without a workspace and never queries", () => {
    render(<MemoryInspectorPanel workspaceId={null} onOpenMemory={vi.fn()} />);

    expect(screen.getByText("fanbox.memoryPanel.empty")).toBeTruthy();
    expect(listSummaryMock).not.toHaveBeenCalled();
  });

  it("falls back to the empty state when the facade fails", async () => {
    listSummaryMock.mockRejectedValue(new Error("backend down"));

    render(<MemoryInspectorPanel workspaceId="ws-1" onOpenMemory={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("fanbox.memoryPanel.empty")).toBeTruthy();
    });
  });

  it("opens the full memory view via the existing entry point", async () => {
    listSummaryMock.mockResolvedValue({ items: [], total: 0 });
    const onOpenMemory = vi.fn();

    render(<MemoryInspectorPanel workspaceId="ws-1" onOpenMemory={onOpenMemory} />);

    fireEvent.click(
      screen.getByRole("button", { name: "fanbox.memoryPanel.open" }),
    );
    expect(onOpenMemory).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(listSummaryMock).toHaveBeenCalled();
    });
  });
});
