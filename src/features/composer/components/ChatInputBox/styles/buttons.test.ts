import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const buttonsCss = readFileSync(
  fileURLToPath(new URL("./buttons.css", import.meta.url)),
  "utf8",
);

describe("chat input button styles", () => {
  it("renders the streaming stop button as a solid rounded square with a visible stop icon", () => {
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*width:\s*32px/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*height:\s*32px/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*aspect-ratio:\s*1 \/ 1/s);
    expect(buttonsCss).toMatch(/\.stop-button\s*\{[^}]*border-radius:\s*10px/s);
    // 用纯色填充 + 显示 codicon 停止图标，不再用旋转的位图背景
    expect(buttonsCss).not.toMatch(/icon\.png/s);
    expect(buttonsCss).toMatch(/\.stop-button \.codicon\s*\{[^}]*opacity:\s*1/s);
  });

  it("replaces the spinning animation with a calm breathing glow", () => {
    // 不再有任何旋转/火花/光环动画
    expect(buttonsCss).not.toMatch(/stop-button-spin/s);
    expect(buttonsCss).not.toMatch(/stop-button-spark/s);
    expect(buttonsCss).not.toMatch(/stop-button-halo/s);
    expect(buttonsCss).not.toMatch(/rotate\(360deg\)/s);
    // 进行中的两个阶段都使用呼吸动画
    expect(buttonsCss).toMatch(/@keyframes stop-button-breathe/s);
    expect(buttonsCss).toMatch(
      /\.stop-button\.is-waiting\s*\{[^}]*stop-button-breathe/s,
    );
    expect(buttonsCss).toMatch(
      /\.stop-button\.is-ingress\s*\{[^}]*stop-button-breathe/s,
    );
  });
});
