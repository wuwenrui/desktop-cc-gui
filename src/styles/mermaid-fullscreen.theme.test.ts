import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = resolve(
  __dirname,
  "mermaid-fullscreen.css",
);
const css = readFileSync(cssPath, "utf8");

describe("mermaid-fullscreen.css theme adapt", () => {
  it("exposes a backdrop blur radius CSS variable at :root", () => {
    expect(css).toMatch(/--mermaid-fullscreen-blur:\s*\d+px/);
  });

  it("exposes a backdrop tint CSS variable at :root", () => {
    expect(css).toMatch(/--mermaid-fullscreen-tint:\s*color-mix/);
  });

  it("drives .viewer-backdrop with backdrop-filter using the variables", () => {
    const backdropRule = css.match(
      /\.viewer-backdrop\s*\{[^}]+\}/,
    );
    expect(backdropRule, "missing .viewer-backdrop rule").toBeTruthy();
    expect(backdropRule?.[0]).toMatch(
      /backdrop-filter:\s*blur\(var\(--mermaid-fullscreen-blur\)\)/,
    );
    expect(backdropRule?.[0]).toMatch(
      /background:\s*var\(--mermaid-fullscreen-tint\)/,
    );
  });

  it("overrides blur for light theme", () => {
    const lightRule = css.match(
      /:root\[data-theme="light"\][^{]*\{[^}]+\}/,
    );
    expect(lightRule, "missing :root[data-theme=light] rule").toBeTruthy();
    expect(lightRule?.[0]).toMatch(
      /--mermaid-fullscreen-blur:\s*1[68]px/,
    );
  });

  it("overrides blur for dim theme", () => {
    const dimRule = css.match(
      /:root\[data-theme="dim"\][^{]*\{[^}]+\}/,
    );
    expect(dimRule, "missing :root[data-theme=dim] rule").toBeTruthy();
    expect(dimRule?.[0]).toMatch(
      /--mermaid-fullscreen-blur:\s*1[4-6]px/,
    );
  });

  it("disables blur for prefers-reduced-motion users", () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[^{]*\{[^}]+--mermaid-fullscreen-blur:\s*0px/,
    );
  });

  it("applies a per-theme tint override for light and dim", () => {
    const lightRule = css.match(
      /:root\[data-theme="light"\][^{]*\{[^}]+\}/,
    )?.[0];
    const dimRule = css.match(
      /:root\[data-theme="dim"\][^{]*\{[^}]+\}/,
    )?.[0];
    expect(lightRule).toMatch(
      /--mermaid-fullscreen-tint:\s*color-mix[^;]*70%/,
    );
    expect(dimRule).toMatch(
      /--mermaid-fullscreen-tint:\s*color-mix[^;]*76%/,
    );
  });

  it("applies blur to .viewer-toolbar so the bottom strip is frosted too", () => {
    const toolbarRule = css.match(
      /\.viewer-toolbar\s*\{[^}]+\}/,
    );
    expect(toolbarRule).toBeTruthy();
    expect(toolbarRule?.[0]).toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(toolbarRule?.[0]).toMatch(
      /background:\s*var\(--mermaid-fullscreen-toolbar-bg\)/,
    );
  });

  it("uses CSS filter (not mask-image) to recolor viewerjs sprite icons per theme", () => {
    // We deliberately do NOT swap to mask-image; that approach required
    // duplicating the sprite and risked mask-position offsets going wrong.
    // Instead we keep viewerjs's original `background-image` and apply a
    // per-theme `filter` to ::before so the white sprite can be inverted
    // on light/dim themes.
    expect(css).not.toMatch(/\.viewer-toolbar > ul > li::before[^}]*mask-image/);
    const beforeRule = css.match(
      /\.viewer-toolbar > ul > li::before\s*\{[^}]+\}/,
    );
    expect(beforeRule, "missing ::before rule").toBeTruthy();
    expect(beforeRule?.[0]).toMatch(
      /filter:\s*var\(--mermaid-fullscreen-icon-filter\)/,
    );
  });

  it("exposes a per-theme --mermaid-fullscreen-icon-filter token", () => {
    expect(css).toMatch(
      /--mermaid-fullscreen-icon-filter:\s*none/,
    );
    expect(css).toMatch(
      /:root\[data-theme="light"\][^{]*\{[^}]*--mermaid-fullscreen-icon-filter:\s*invert/,
    );
    expect(css).toMatch(
      /:root\[data-theme="dim"\][^{]*\{[^}]*--mermaid-fullscreen-icon-filter:\s*invert/,
    );
  });

  it("keeps .viewer-button visible at rest (border + token-driven background)", () => {
    const buttonRule = css.match(
      /\.viewer-button\s*\{[^}]+\}/,
    );
    expect(buttonRule, "missing .viewer-button rule").toBeTruthy();
    expect(buttonRule?.[0]).toMatch(
      /background-color:\s*var\(--mermaid-fullscreen-button-bg\)/,
    );
    expect(buttonRule?.[0]).toMatch(
      /border:\s*1px solid var\(--mermaid-fullscreen-button-border\)/,
    );
    const buttonBefore = css.match(
      /\.viewer-button::before\s*\{[^}]+\}/,
    );
    expect(buttonBefore, "missing .viewer-button::before rule").toBeTruthy();
    expect(buttonBefore?.[0]).toMatch(
      /filter:\s*var\(--mermaid-fullscreen-icon-filter\)/,
    );
  });

  it("uses dedicated light-theme control colors for close button and toolbar", () => {
    const lightRule = css.match(
      /:root\[data-theme="light"\][^{]*\{[^}]+\}/,
    )?.[0];
    expect(lightRule, "missing :root[data-theme=light] rule").toBeTruthy();
    expect(lightRule).toMatch(
      /--mermaid-fullscreen-button-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.92\)/,
    );
    expect(lightRule).toMatch(
      /--mermaid-fullscreen-button-border:\s*rgba\(17,\s*24,\s*39,\s*0\.28\)/,
    );
    expect(lightRule).toMatch(
      /--mermaid-fullscreen-toolbar-bg:\s*rgba\(248,\s*250,\s*252,\s*0\.74\)/,
    );
    expect(lightRule).toMatch(
      /--mermaid-fullscreen-toolbar-item-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.86\)/,
    );
  });

  it("uses dedicated dim-theme control colors distinct from light and dark", () => {
    const dimRule = css.match(
      /:root\[data-theme="dim"\][^{]*\{[^}]+\}/,
    )?.[0];
    expect(dimRule, "missing :root[data-theme=dim] rule").toBeTruthy();
    expect(dimRule).toMatch(
      /--mermaid-fullscreen-button-bg:\s*rgba\(244,\s*247,\s*251,\s*0\.82\)/,
    );
    expect(dimRule).toMatch(
      /--mermaid-fullscreen-button-border:\s*rgba\(23,\s*32,\s*51,\s*0\.26\)/,
    );
    expect(dimRule).toMatch(
      /--mermaid-fullscreen-toolbar-bg:\s*rgba\(232,\s*237,\s*246,\s*0\.64\)/,
    );
    expect(dimRule).toMatch(
      /--mermaid-fullscreen-toolbar-item-bg:\s*rgba\(245,\s*248,\s*252,\s*0\.78\)/,
    );
  });
});
