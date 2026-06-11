import { describe, expect, it } from "vitest";
import { buildAppTypographyCssVars } from "./typographyCssVars";

describe("buildAppTypographyCssVars", () => {
  it("builds shared typography variables from app font settings", () => {
    expect(
      buildAppTypographyCssVars({
        uiFontFamily: "Test UI",
        codeFontFamily: "Test Mono",
        codeFontSize: 15,
      }),
    ).toMatchObject({
      "--ui-font-family": "Test UI",
      "--code-font-family": "Test Mono",
      "--code-font-size": "15px",
      "--app-font-size-xs": "clamp(9px, calc(15px - 1px), 13px)",
      "--app-font-size-sm": "clamp(10px, 15px, 15px)",
      "--app-font-size-md": "clamp(11px, calc(15px + 1px), 17px)",
      "--client-caption-font-size": "var(--app-font-size-xs)",
      "--client-meta-font-size": "var(--app-font-size-sm)",
      "--client-content-font-size": "var(--app-font-size-md)",
    });
  });

  it("falls back to the default code font size for invalid input", () => {
    expect(
      buildAppTypographyCssVars({
        uiFontFamily: "Test UI",
        codeFontFamily: "Test Mono",
        codeFontSize: Number.NaN,
      })["--code-font-size"],
    ).toBe("11px");
  });
});
