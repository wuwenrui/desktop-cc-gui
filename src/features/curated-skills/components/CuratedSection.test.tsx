// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CuratedSection } from "./CuratedSection";
import type { CuratedSkillOption } from "../../../types";

vi.mock("../../settings/hooks/useAppSettings", () => ({
  useAppSettings: () => ({
    settings: { enabledCuratedSkillIds: [] },
    setSettings: () => undefined,
    saveSettings: () => Promise.resolve({}),
    isLoading: false,
  }),
}));

const { sampleSkills, useCuratedSkillsState } = vi.hoisted(() => {
  const skills = [
    {
      name: "lazy-senior-dev",
      displayName: "Lazy senior dev",
      version: "4.8.1",
      description:
        "Ponytail 7-level Ladder: prefer YAGNI, reuse what's already in the codebase, lean on stdlib / platform / already-installed deps, and write the smallest diff that holds.",
      icon: "sparkles",
      category: "code-style" as const,
      tokenEstimate: 1100,
      source: "upstream: DietrichGebert/ponytail v4.8.1",
      sourceUrl: "https://github.com/DietrichGebert/ponytail",
      license: "MIT",
      enabled: false,
    },
  ];
  const useCuratedSkillsState: { skills: CuratedSkillOption[] } = { skills };
  return { sampleSkills: skills, useCuratedSkillsState };
});

vi.mock("../hooks/useCuratedSkills", () => ({
  useCuratedSkills: (_options: { enabledCuratedSkillIds: string[] | undefined }) => ({
    skills: useCuratedSkillsState.skills,
    loading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}));

vi.mock("../hooks/useCuratedSkillToggle", () => ({
  useCuratedSkillToggle: (_options: { setSettings: unknown }) => ({
    setEnabled: vi.fn().mockResolvedValue(undefined),
    pendingId: null,
    error: null,
  }),
}));

describe("CuratedSection", () => {
  it("renders the Built-in badge, display name, category, license and version", () => {
    render(<CuratedSection />);
    // The section heading
    expect(screen.getByText("Curated")).toBeTruthy();
    // Row content (no toBeInTheDocument matcher in this repo's vitest setup).
    expect(screen.getByText("Lazy senior dev")).toBeTruthy();
    expect(screen.getByText("Code style")).toBeTruthy();
    expect(screen.getByText("MIT")).toBeTruthy();
    expect(screen.getByText("v4.8.1")).toBeTruthy();
  });

  it("renders a lucide icon, not a bare text node, for the icon field", () => {
    const { container } = render(<CuratedSection />);
    // The icon slot has data-icon="sparkles" and should contain an
    // actual <svg> child (lucide icons render as SVG). Previously this
    // was just the bare text "sparkles" which is what the user reported.
    const iconSlot = container.querySelector('[data-icon="sparkles"]');
    expect(iconSlot).toBeTruthy();
    expect(iconSlot?.querySelector("svg")).toBeTruthy();
  });

  it("uses kebab-case ASCII data-icon attribute (preserved for testability)", () => {
    const { container } = render(<CuratedSection />);
    expect(container.querySelector('[data-icon="sparkles"]')).toBeTruthy();
  });

  it("renders a 'View on GitHub' link that points at the upstream source URL", () => {
    const { container } = render(<CuratedSection />);
    const link = container.querySelector(
      '[data-testid="curated-row-source-lazy-senior-dev"]',
    ) as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe(
      "https://github.com/DietrichGebert/ponytail",
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent ?? "").toContain("View on GitHub");
  });

  it("hides the GitHub link when the skill has no sourceUrl", () => {
    // Swap the hoisted mock state to a skill with no sourceUrl, then
    // restore after this test so subsequent tests still see the
    // GitHub link.
    const original = useCuratedSkillsState.skills;
    // Re-create the entry without `sourceUrl` so the field is
    // absent (matching the JSON contract) rather than explicitly
    // `undefined` (which doesn't satisfy the optional `string` type).
    const { sourceUrl: _omit, ...rest } = sampleSkills[0];
    void _omit;
    useCuratedSkillsState.skills = [rest as CuratedSkillOption];
    try {
      const { container } = render(<CuratedSection />);
      expect(
        container.querySelector(
          '[data-testid="curated-row-source-lazy-senior-dev"]',
        ),
      ).toBeNull();
    } finally {
      useCuratedSkillsState.skills = original;
    }
  });

  it("renders with the expected DOM shape (visual snapshot)", () => {
    // This is a hand-verified snapshot of the CuratedSection markup.
    // The test is intentionally permissive: it checks the structure but
    // does not pin a string match. Update this when intentional DOM
    // changes are made.
    const { container } = render(<CuratedSection />);
    const section = container.querySelector('[data-testid="curated-section"]');
    expect(section).toBeTruthy();
    expect(section?.getAttribute("data-count")).toBe("1");

    // Header layout: title on the left, "Built-in" badge on the right
    const head = section?.querySelector(".curated-section-head");
    expect(head).toBeTruthy();
    const title = head?.querySelector(".curated-section-title");
    expect(title).toBeTruthy();
    expect(title?.textContent ?? "").toContain("Curated");

    // The title icon should be a lucide-rendered SVG (not raw text).
    // We use a class-prefix selector because lucide icons attach the
    // className directly to the svg itself.
    const titleIcon = title?.querySelector("svg");
    expect(titleIcon).toBeTruthy();

    const badge = head?.querySelector(".curated-section-badge");
    expect(badge?.textContent ?? "").toContain("Built-in");

    // Subtitle (i18n key falls back to default in tests).
    const subtitle = section?.querySelector(".curated-section-subtitle");
    expect(subtitle).toBeTruthy();
    expect(subtitle?.textContent ?? "").toContain("Client-bundled");

    // Row: icon (SVG), name, category pill, GitHub link, description, meta (token/license/version).
    const row = section?.querySelector(".curated-section-row");
    expect(row).toBeTruthy();
    expect(row?.getAttribute("data-testid")).toBe("curated-row-lazy-senior-dev");
    expect(row?.getAttribute("data-enabled")).toBe("false");

    const rowIcon = row?.querySelector(".curated-section-row-icon svg, .curated-section-row-icon");
    expect(rowIcon).toBeTruthy();

    const name = row?.querySelector(".curated-section-row-name");
    expect(name?.textContent).toBe("Lazy senior dev");

    const category = row?.querySelector(".curated-section-row-category");
    expect(category?.getAttribute("data-category")).toBe("code-style");

    const source = row?.querySelector(
      "[data-testid=\"curated-row-source-lazy-senior-dev\"]",
    );
    expect(source).toBeTruthy();
    expect(source?.getAttribute("href")).toBe(
      "https://github.com/DietrichGebert/ponytail",
    );

    const description = row?.querySelector(".curated-section-row-description");
    expect(description?.textContent ?? "").toContain("Ponytail");

    const meta = row?.querySelector(".curated-section-row-meta");
    expect(meta?.textContent ?? "").toContain("MIT");
    expect(meta?.textContent ?? "").toContain("v4.8.1");
  });
});
