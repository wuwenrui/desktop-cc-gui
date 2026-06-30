import { describe, expect, it } from "vitest";
import { resolveLucideIcon, FALLBACK_ICON } from "./resolveLucideIcon";

describe("resolveLucideIcon", () => {
  it("returns a component for a known icon name", () => {
    // lucide icons are `forwardRef` objects; we accept anything
    // non-null as a valid component (React will reject non-callable
    // values when it tries to instantiate them).
    const Icon = resolveLucideIcon("sparkles");
    expect(Icon).not.toBeNull();
    expect(Icon).toBeDefined();
  });

  it("returns a component for file-text", () => {
    const Icon = resolveLucideIcon("file-text");
    expect(Icon).not.toBeNull();
    expect(Icon).toBeDefined();
  });

  it("returns null for an unknown icon name", () => {
    // Real icons are kebab-case ASCII per build.rs Decision 9. Anything
    // else (or a name that doesn't exist) must resolve to null so the
    // caller can fall back gracefully.
    const Icon = resolveLucideIcon("not-a-real-icon-name-xyz");
    expect(Icon).toBeNull();
  });

  it("returns null for empty / undefined input", () => {
    expect(resolveLucideIcon("")).toBeNull();
    expect(resolveLucideIcon(undefined)).toBeNull();
  });

  it("FALLBACK_ICON is a stable component", () => {
    expect(FALLBACK_ICON).toBeDefined();
    expect(FALLBACK_ICON).not.toBeNull();
  });
});
