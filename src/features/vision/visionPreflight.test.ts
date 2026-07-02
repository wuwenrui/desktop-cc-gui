import { describe, expect, it } from "vitest";
import {
  buildVisionPreflightStatusText,
  injectVisionPreflightContext,
  parseVisionPreflightStatus,
  stripVisionPreflightContext,
  type VisionPreflightResult,
  type VisionPreflightStatus,
} from "./visionPreflight";

const preflightResult: VisionPreflightResult = {
  mode: "ocr",
  model: "qwen3-vl-flash",
  skillName: "视觉OCR",
  imageCount: 1,
  text: "# 关联关系证明\n\n兹证明: 相关 OCR 提取内容",
};

describe("stripVisionPreflightContext", () => {
  it("restores the original user text after injection round-trip", () => {
    const userText = "去看看客户提供的最新的对方草拟的文件。\n然后草拟一稿说明材料。";
    const injected = injectVisionPreflightContext(userText, preflightResult);

    expect(injected).toContain("<hidden_vision_preflight_result>");
    expect(stripVisionPreflightContext(injected)).toBe(userText);
  });

  it("strips an unterminated block to the end of the text", () => {
    const truncated = [
      "用户请求",
      "",
      "<hidden_vision_preflight_result>",
      "source_skill: 视觉OCR",
      "vision_model: qwen3-vl-flash",
      "mode: ocr",
      "",
      "被截断的 OCR 输出",
    ].join("\n");

    expect(stripVisionPreflightContext(truncated)).toBe("用户请求");
  });

  it("removes the trailing evidence instruction line", () => {
    const injected = injectVisionPreflightContext("请分析文件", preflightResult);

    expect(injected).toContain("Use the hidden vision preflight result");
    expect(stripVisionPreflightContext(injected)).not.toContain(
      "Use the hidden vision preflight result",
    );
  });

  it("returns text without a preflight block unchanged", () => {
    const plain = "普通消息，没有视觉预处理。";
    expect(stripVisionPreflightContext(plain)).toBe(plain);
  });
});

describe("visionPreflightStatus", () => {
  it("round-trips running, done and failed status payloads", () => {
    const statuses: VisionPreflightStatus[] = [
      {
        status: "running",
        skillName: "视觉OCR",
        model: "qwen3-vl-flash",
        mode: "ocr",
        imageCount: 2,
      },
      {
        status: "done",
        skillName: "视觉OCR",
        model: "qwen3-vl-flash",
        mode: "ocr",
        imageCount: 2,
        resultChars: 1234,
        durationMs: 28000,
      },
      {
        status: "failed",
        skillName: "文件转Markdown",
        model: "qwen3-vl-flash",
        mode: "file-to-markdown",
        imageCount: 1,
        durationMs: 3000,
        errorMessage: "network error",
      },
    ];
    for (const status of statuses) {
      expect(
        parseVisionPreflightStatus(buildVisionPreflightStatusText(status)),
      ).toEqual(status);
    }
  });

  it("returns null for plain text and malformed payloads", () => {
    expect(parseVisionPreflightStatus("普通助手消息")).toBeNull();
    expect(parseVisionPreflightStatus("【视觉解析】\nnot-json")).toBeNull();
    expect(
      parseVisionPreflightStatus('【视觉解析】\n{"status":"unknown"}'),
    ).toBeNull();
  });
});
