import { describe, expect, it } from "vitest";
import {
  isNavVisible,
  LAWYER_VISIBLE_NAV,
  type NavEntryId,
} from "./navVisibility";

const ALL_ENTRIES: NavEntryId[] = [
  "home-chat",
  "kanban",
  "global-search",
  "skill-market",
  "lawhub",
  "cases",
  "quick-skills",
  "lock",
  "spec-hub",
  "memory",
  "git-history",
  "environment",
  "release-notes",
  "settings",
];

describe("navVisibility", () => {
  it("developer mode shows everything", () => {
    for (const entry of ALL_ENTRIES) {
      expect(isNavVisible("developer", entry)).toBe(true);
    }
  });

  it("undefined uiMode (legacy settings) behaves like developer", () => {
    for (const entry of ALL_ENTRIES) {
      expect(isNavVisible(undefined, entry)).toBe(true);
    }
  });

  it("lawyer mode keeps the whitelist: cases / skill-market / lawhub / settings", () => {
    expect(isNavVisible("lawyer", "cases")).toBe(true);
    expect(isNavVisible("lawyer", "skill-market")).toBe(true);
    expect(isNavVisible("lawyer", "lawhub")).toBe(true);
    expect(isNavVisible("lawyer", "settings")).toBe(true);
  });

  it("lawyer mode hides developer chrome", () => {
    expect(isNavVisible("lawyer", "home-chat")).toBe(false);
    expect(isNavVisible("lawyer", "kanban")).toBe(false);
    expect(isNavVisible("lawyer", "global-search")).toBe(false);
    expect(isNavVisible("lawyer", "spec-hub")).toBe(false);
    expect(isNavVisible("lawyer", "memory")).toBe(false);
    expect(isNavVisible("lawyer", "git-history")).toBe(false);
    expect(isNavVisible("lawyer", "quick-skills")).toBe(false);
  });

  it("whitelist only contains valid entry ids and includes cases", () => {
    expect(LAWYER_VISIBLE_NAV).toContain("cases");
    for (const entry of LAWYER_VISIBLE_NAV) {
      expect(ALL_ENTRIES).toContain(entry);
    }
  });
});
