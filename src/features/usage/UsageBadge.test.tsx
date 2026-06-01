/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsageBadge, type NewapiUsage } from "./UsageBadge";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const sampleUsage: NewapiUsage = {
  granted_cny: 730,
  used_cny: 12.5,
  available_cny: 717.5,
  unlimited: false,
};

describe("UsageBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the loading placeholder before data resolves", () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    render(<UsageBadge />);
    expect(screen.getByText("用量加载中…")).toBeTruthy();
  });

  it("renders balance and used amount from invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(sampleUsage);
    render(<UsageBadge />);

    await waitFor(() => {
      expect(screen.getByText("余额 ¥717.50 · 已用 ¥12.50")).toBeTruthy();
    });
    expect(invoke).toHaveBeenCalledWith("get_newapi_usage");
  });

  it("renders an error placeholder when invoke rejects", async () => {
    vi.mocked(invoke).mockRejectedValue("未配置 new-api");
    render(<UsageBadge />);

    await waitFor(() => {
      expect(screen.getByText("用量不可用")).toBeTruthy();
    });
  });

  it("shows unlimited balance when usage is unlimited", async () => {
    vi.mocked(invoke).mockResolvedValue({
      ...sampleUsage,
      unlimited: true,
    });
    render(<UsageBadge />);

    await waitFor(() => {
      expect(screen.getByText("余额 不限额 · 已用 ¥12.50")).toBeTruthy();
    });
  });

  it("refreshes on a 60s interval and clears the timer on unmount", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(invoke).mockResolvedValue(sampleUsage);
      const { unmount } = render(<UsageBadge />);

      // Initial fetch on mount.
      expect(invoke).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(invoke).toHaveBeenCalledTimes(2);

      unmount();
      await vi.advanceTimersByTimeAsync(120_000);
      // No further calls after unmount (interval cleared).
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
