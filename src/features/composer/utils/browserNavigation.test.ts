import { describe, expect, it } from "vitest";
import { resolveBrowserNavigationUrl } from "./browserNavigation";

describe("resolveBrowserNavigationUrl", () => {
  it("resolves explicit short navigation commands", () => {
    expect(resolveBrowserNavigationUrl("打开 https://hatch.rs/")).toBe("https://hatch.rs/");
    expect(resolveBrowserNavigationUrl("访问 hatch.rs")).toBe("https://hatch.rs");
    expect(resolveBrowserNavigationUrl("open https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
    expect(resolveBrowserNavigationUrl("go to example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("keeps known short destinations", () => {
    expect(resolveBrowserNavigationUrl("百度")).toBe("https://www.baidu.com/");
    expect(resolveBrowserNavigationUrl("打开百度")).toBe("https://www.baidu.com/");
    expect(resolveBrowserNavigationUrl("open baidu")).toBe("https://www.baidu.com/");
  });

  it("does not treat descriptive bug reports as browser commands", () => {
    expect(
      resolveBrowserNavigationUrl(
        "我明明是给你发送文本现在莫名其妙.打开 Browser Dock 这个逻辑太宽了",
      ),
    ).toBeNull();
    expect(
      resolveBrowserNavigationUrl(
        "打开 Browser Dock 这个逻辑太宽了 截图是我发的内容会导致的打开",
      ),
    ).toBeNull();
    expect(resolveBrowserNavigationUrl("日志里有 https://hatch.rs/，但不要打开")).toBeNull();
  });
});
