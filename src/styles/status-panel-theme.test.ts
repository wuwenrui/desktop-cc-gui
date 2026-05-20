import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const statusPanelCss = readFileSync(
  fileURLToPath(new URL("./status-panel.css", import.meta.url)),
  "utf8",
);

describe("status panel theme colors", () => {
  it("keeps checkpoint commit dialog colors derived from theme tokens", () => {
    expect(statusPanelCss).toContain("--sp-commit-surface:");
    expect(statusPanelCss).toContain("--sp-commit-text:");
    expect(statusPanelCss).toContain("--sp-commit-success:");
    expect(statusPanelCss).toContain("--sp-commit-danger:");
    expect(statusPanelCss).toMatch(
      /\.sp-checkpoint-commit-dialog\s*\{[^}]*background:\s*var\(--sp-commit-surface\)/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-checkpoint-commit-message-section \.commit-message-input\s*\{[^}]*background:\s*var\(--sp-commit-surface-control\)/s,
    );
    expect(statusPanelCss).not.toMatch(
      /sp-checkpoint-commit[\s\S]*var\(--success-color\)/,
    );
    expect(statusPanelCss).not.toMatch(
      /sp-checkpoint-commit[\s\S]*color:\s*#ef4444/,
    );
  });

  it("renders checkpoint commit action as a theme-aware icon text action", () => {
    expect(statusPanelCss).toMatch(
      /\.sp-checkpoint-action--commit\s*\{[^}]*border-color:\s*transparent/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-checkpoint-action--commit\s*\{[^}]*background:\s*transparent/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-checkpoint-action--commit\s*\{[^}]*color:\s*var\(--text-strong\)/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-checkpoint-action--commit svg\s*\{[^}]*color:\s*currentColor/s,
    );
    expect(statusPanelCss).not.toMatch(
      /\.sp-checkpoint-action--commit\s*\{[^}]*linear-gradient/s,
    );
  });

  it("keeps governance evidence compact and theme-token driven", () => {
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence\s*\{[^}]*--sp-governance-chip-bg:\s*color-mix\([^}]*var\(--surface-item\)/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence\s*\{[^}]*font-family:\s*var\(--ui-font-family\)/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence\s*\{[^}]*--sp-governance-copy-size:\s*12px/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence-item\s*\{[^}]*display:\s*flex/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence-title\s*\{[^}]*font-size:\s*var\(--sp-governance-copy-size\)/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence-title\s*\{[^}]*overflow-wrap:\s*anywhere/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence-status\.is-pass\s*\{[^}]*color:\s*var\(--sp-governance-success\)/s,
    );
    expect(statusPanelCss).toMatch(
      /\.sp-governance-evidence-status\.is-warn\s*\{[^}]*color:\s*var\(--sp-governance-warning\)/s,
    );
    expect(statusPanelCss).not.toMatch(
      /\.sp-governance-evidence(?:-[\w-]+)?\s*\{[^}]*background:\s*#[0-9a-f]{3,8}/i,
    );
    expect(statusPanelCss).not.toMatch(
      /\.sp-governance-evidence-title\s*\{[^}]*text-overflow:\s*ellipsis/s,
    );
    expect(statusPanelCss).not.toContain(".sp-checkpoint-evidence-trail");
  });
});
