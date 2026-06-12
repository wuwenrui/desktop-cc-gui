import { describe, expect, it } from "vitest";
import {
  buildSkillTree,
  isSubSkillPath,
  pickDefaultFile,
  type SkillFileEntry,
} from "./skillTree";

const entries: SkillFileEntry[] = [
  { path: "sub-skills/05_evidence_SKILL.md", size: 30, is_dir: false },
  { path: "SKILL.md", size: 100, is_dir: false },
  { path: "references/", size: 0, is_dir: true },
  { path: "references/contract.md", size: 50, is_dir: false },
  { path: "sub-skills/01_intake_SKILL.md", size: 20, is_dir: false },
  { path: "references/crime-elements/economic.md", size: 10, is_dir: false },
  { path: "CHANGELOG.md", size: 5, is_dir: false },
];

describe("buildSkillTree", () => {
  it("should nest entries and auto-create missing intermediate dirs", () => {
    const tree = buildSkillTree(entries);
    const refs = tree.find((n) => n.name === "references");
    expect(refs?.isDir).toBe(true);
    const crime = refs?.children.find((n) => n.name === "crime-elements");
    expect(crime?.isDir).toBe(true);
    expect(crime?.children.map((n) => n.name)).toEqual(["economic.md"]);
  });

  it("should sort files before dirs, each alphabetically", () => {
    const tree = buildSkillTree(entries);
    expect(tree.map((n) => n.name)).toEqual([
      "CHANGELOG.md",
      "SKILL.md",
      "references",
      "sub-skills",
    ]);
    const subSkills = tree.find((n) => n.name === "sub-skills");
    expect(subSkills?.children.map((n) => n.name)).toEqual([
      "01_intake_SKILL.md",
      "05_evidence_SKILL.md",
    ]);
  });

  it("should keep file sizes and full paths", () => {
    const tree = buildSkillTree(entries);
    const main = tree.find((n) => n.name === "SKILL.md");
    expect(main?.size).toBe(100);
    const subSkills = tree.find((n) => n.name === "sub-skills");
    expect(subSkills?.children[0]?.path).toBe("sub-skills/01_intake_SKILL.md");
  });

  it("should return empty tree for empty input", () => {
    expect(buildSkillTree([])).toEqual([]);
  });
});

describe("isSubSkillPath", () => {
  it("should match sub-skills/*_SKILL.md only", () => {
    expect(isSubSkillPath("sub-skills/01_intake_SKILL.md")).toBe(true);
    expect(isSubSkillPath("sub-skills/05_证据目录_SKILL.md")).toBe(true);
    expect(isSubSkillPath("sub-skills/README.md")).toBe(false);
    expect(isSubSkillPath("references/contract.md")).toBe(false);
    expect(isSubSkillPath("SKILL.md")).toBe(false);
    expect(isSubSkillPath("sub-skills/nested/01_x_SKILL.md")).toBe(false);
  });
});

describe("pickDefaultFile", () => {
  it("should prefer root SKILL.md", () => {
    expect(pickDefaultFile(entries)).toBe("SKILL.md");
  });

  it("should fall back to the first file when no SKILL.md", () => {
    expect(
      pickDefaultFile([
        { path: "a/b.md", size: 1, is_dir: false },
        { path: "a/", size: 0, is_dir: true },
      ]),
    ).toBe("a/b.md");
  });

  it("should return null when there is no file", () => {
    expect(pickDefaultFile([{ path: "a/", size: 0, is_dir: true }])).toBe(null);
  });
});
