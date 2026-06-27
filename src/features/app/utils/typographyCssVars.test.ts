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
      "--app-font-size-xs": "10px",
      "--app-font-size-sm": "12px",
      "--app-font-size-md": "13px",
      "--app-font-size-lg": "16px",
      "--client-caption-font-size": "var(--app-font-size-xs)",
      "--client-meta-font-size": "var(--app-font-size-sm)",
      "--client-content-font-size": "var(--app-font-size-md)",
      "--client-title-font-size": "var(--app-font-size-lg)",
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

  it("keeps readable UI typography independent from code font size", () => {
    const compactCode = buildAppTypographyCssVars({
      uiFontFamily: "Test UI",
      codeFontFamily: "Test Mono",
      codeFontSize: 9,
    });
    const largeCode = buildAppTypographyCssVars({
      uiFontFamily: "Test UI",
      codeFontFamily: "Test Mono",
      codeFontSize: 16,
    });

    expect(compactCode["--client-content-font-size"]).toBe(
      largeCode["--client-content-font-size"],
    );
    expect(compactCode["--app-font-size-md"]).toBe(largeCode["--app-font-size-md"]);
    expect(compactCode["--code-font-size"]).not.toBe(largeCode["--code-font-size"]);
  });
});
