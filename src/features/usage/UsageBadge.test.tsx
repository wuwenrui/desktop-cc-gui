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
      expect(screen.getByText("¥717.50")).toBeTruthy();
    });
    expect(screen.getByText("已用 ¥12.50")).toBeTruthy();
    // The accessible label combines the figures into one screen-reader string.
    expect(screen.getByLabelText("余额 ¥717.50，已用 ¥12.50")).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("get_newapi_usage");
  });

  it("flags a low balance with the warning modifier", async () => {
    vi.mocked(invoke).mockResolvedValue({
      ...sampleUsage,
      available_cny: 2.5,
    });
    const { container } = render(<UsageBadge />);

    await waitFor(() => {
      expect(screen.getByText("¥2.50")).toBeTruthy();
    });
    expect(container.querySelector(".usage-badge--low")).toBeTruthy();
  });

  it("does not flag a healthy balance as low", async () => {
    vi.mocked(invoke).mockResolvedValue(sampleUsage);
    const { container } = render(<UsageBadge />);

    await waitFor(() => {
      expect(screen.getByText("¥717.50")).toBeTruthy();
    });
    expect(container.querySelector(".usage-badge--low")).toBeNull();
  });

  it("clamps a negative available balance to zero", async () => {
    vi.mocked(invoke).mockResolvedValue({
      ...sampleUsage,
      available_cny: -0.01,
    });
    render(<UsageBadge />);

    await waitFor(() => {
      // Over-drawn tokens must never render as a negative figure.
      expect(screen.getByText("¥0.00")).toBeTruthy();
    });
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
      expect(screen.getByText("不限额")).toBeTruthy();
    });
    expect(screen.getByText("已用 ¥12.50")).toBeTruthy();
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
