// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowLabel } from "./useWindowLabel";

const getCurrentWindowMock = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => getCurrentWindowMock(),
}));

describe("useWindowLabel", () => {
  beforeEach(() => {
    getCurrentWindowMock.mockReset();
  });

  it("uses the current Tauri window label on the first render", () => {
    getCurrentWindowMock.mockReturnValue({ label: "about" });
    let firstRenderLabel: string | undefined;

    renderHook(() => {
      const label = useWindowLabel();
      firstRenderLabel ??= label;
      return label;
    });

    expect(firstRenderLabel).toBe("about");
  });
});
