/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import {
  SKILL_INSTALLED_EVENT,
  notifySkillInstalled,
  sortInstalledSkills,
} from "./installedSkills";

describe("sortInstalledSkills", () => {
  it("should put legacy entries (no installed_at) first by name, then stamped ascending", () => {
    const items = sortInstalledSkills({
      "z-new": { skill_id: 3, version: 1, installed_at: 200 },
      "a-old": { skill_id: 1, version: 1 },
      "b-old": { skill_id: 2, version: 2, installed_at: null },
      "c-new": { skill_id: 4, version: 1, installed_at: 100 },
    });
    expect(items.map((i) => i.name)).toEqual([
      "a-old",
      "b-old",
      "c-new",
      "z-new",
    ]);
  });

  it("should fall back to name for equal timestamps", () => {
    const items = sortInstalledSkills({
      bbb: { skill_id: 1, version: 1, installed_at: 100 },
      aaa: { skill_id: 2, version: 1, installed_at: 100 },
    });
    expect(items.map((i) => i.name)).toEqual(["aaa", "bbb"]);
  });

  it("should use display_name when present and fall back to name", () => {
    const items = sortInstalledSkills({
      "civil-litigation-master": {
        skill_id: 1,
        version: 1,
        display_name: "民商事诉讼大师",
      },
      "criminal-defense-workflow": { skill_id: 2, version: 1 },
      blank: { skill_id: 3, version: 1, display_name: "  " },
    });
    const byName = Object.fromEntries(items.map((i) => [i.name, i.displayName]));
    expect(byName["civil-litigation-master"]).toBe("民商事诉讼大师");
    expect(byName["criminal-defense-workflow"]).toBe(
      "criminal-defense-workflow",
    );
    expect(byName["blank"]).toBe("blank");
  });

  it("should return empty list for empty index", () => {
    expect(sortInstalledSkills({})).toEqual([]);
  });
});

describe("notifySkillInstalled", () => {
  it("should dispatch the installed event with the skill name", () => {
    const onEvent = vi.fn();
    window.addEventListener(SKILL_INSTALLED_EVENT, onEvent as EventListener);
    try {
      notifySkillInstalled("civil-litigation-master");
      expect(onEvent).toHaveBeenCalledTimes(1);
      const detail = (onEvent.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toEqual({ name: "civil-litigation-master" });
    } finally {
      window.removeEventListener(
        SKILL_INSTALLED_EVENT,
        onEvent as EventListener,
      );
    }
  });
});
