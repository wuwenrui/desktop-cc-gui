import { describe, expect, it } from "vitest";
import {
  cleanCapabilityName,
  deriveCapabilities,
  deriveSubSkillIntro,
  extractExamplePhrases,
  parseSkillDescription,
  summarizeDescription,
} from "./skillMeta";

const FOLDED = `---
name: 刑事辩护全流程·Pro版
description: >
  顶级刑事律师全流程辩护技能。覆盖刑事案件辩护的完整生命周期。
  当用户涉及刑事案件辩护工作时触发，包括但不限于："帮我阅卷分析刑事案件""写质证意见"
  "撰写辩护词"等。
version: 3.0.0
---

# 正文
`;

describe("parseSkillDescription", () => {
  it("parses folded (>) multi-line description", () => {
    const desc = parseSkillDescription(FOLDED);
    expect(desc).toContain("顶级刑事律师全流程辩护技能");
    expect(desc).toContain("撰写辩护词");
  });

  it("parses inline description and strips quotes", () => {
    const md = `---\nname: x\ndescription: "把文件整理成 Markdown"\n---\nbody`;
    expect(parseSkillDescription(md)).toBe("把文件整理成 Markdown");
  });

  it("returns null without frontmatter or description", () => {
    expect(parseSkillDescription("# 没有 frontmatter")).toBeNull();
    expect(parseSkillDescription("---\nname: x\n---\nbody")).toBeNull();
  });
});

describe("cleanCapabilityName / deriveCapabilities", () => {
  it("strips numeric prefix and SKILL suffix", () => {
    expect(cleanCapabilityName("01_案件接收与初步评估_SKILL.md")).toBe(
      "案件接收与初步评估",
    );
    expect(cleanCapabilityName("10_量刑辩护专项_SKILL.md")).toBe("量刑辩护专项");
  });

  it("derives ordered capability list with paths from sub-skills entries", () => {
    const caps = deriveCapabilities([
      { path: "SKILL.md", size: 1, is_dir: false },
      { path: "sub-skills", size: 0, is_dir: true },
      { path: "sub-skills/02_会见当事人_SKILL.md", size: 1, is_dir: false },
      { path: "sub-skills/01_案件接收_SKILL.md", size: 1, is_dir: false },
      { path: "references/指南.md", size: 1, is_dir: false },
    ]);
    expect(caps).toEqual([
      { label: "案件接收", path: "sub-skills/01_案件接收_SKILL.md" },
      { label: "会见当事人", path: "sub-skills/02_会见当事人_SKILL.md" },
    ]);
  });
});

describe("extractExamplePhrases", () => {
  it("extracts deduped quoted phrases capped at 6", () => {
    const phrases = extractExamplePhrases(
      '触发："帮我阅卷分析刑事案件""写质证意见""写质证意见""做证据分析报告"',
    );
    expect(phrases).toEqual([
      "帮我阅卷分析刑事案件",
      "写质证意见",
      "做证据分析报告",
    ]);
  });

  it("returns empty array without quotes", () => {
    expect(extractExamplePhrases("没有引号的描述")).toEqual([]);
  });
});

describe("deriveSubSkillIntro", () => {
  it("prefers frontmatter description", () => {
    const md = "---\nname: x\ndescription: 接收后初步评估，建立案件档案\n---\n# 标题\n正文";
    expect(deriveSubSkillIntro(md)).toBe("接收后初步评估，建立案件档案");
  });

  it("falls back to leading body text without frontmatter", () => {
    const md = "# 标题\n\n第一段说明。\n\n## 小节\n第二段。";
    expect(deriveSubSkillIntro(md)).toBe("第一段说明。 第二段。");
  });
});

describe("summarizeDescription", () => {
  it("flattens whitespace and truncates", () => {
    expect(summarizeDescription("a\n  b   c")).toBe("a b c");
    const long = "字".repeat(100);
    expect(summarizeDescription(long).length).toBe(91);
  });
});
