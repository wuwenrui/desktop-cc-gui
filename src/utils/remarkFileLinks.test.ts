import { describe, expect, it } from "vitest";
import { isLinkableFilePath } from "./remarkFileLinks";

describe("isLinkableFilePath", () => {
  it("does not linkify CJK prose that merely contains slashes", () => {
    expect(isLinkableFilePath("/分支/历史回溯")).toBe(false);
    expect(isLinkableFilePath("/分支/历史")).toBe(false);
    expect(isLinkableFilePath("复制/分支/历史")).toBe(false);
  });

  it("still recognizes real ASCII file paths", () => {
    expect(isLinkableFilePath("/Users/test/a.rs")).toBe(true);
    expect(isLinkableFilePath("src/index.ts")).toBe(true);
    expect(isLinkableFilePath("./config/app.json")).toBe(true);
  });

  it("recognizes paths with CJK segments as long as one ASCII segment exists", () => {
    expect(isLinkableFilePath("/Users/张三/code/a.ts")).toBe(true);
  });
});
