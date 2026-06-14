import { describe, expect, it } from "vitest";
import type { MessageSendOptions } from "../../types";
import {
  buildVisionSendOptions,
  DEFAULT_VISION_MODEL_ID,
  FILE_TO_MARKDOWN_SKILL_NAME,
  inferVisionModelCapabilities,
  pickPreferredVisionModelId,
  resolveVisionModelId,
  VISION_OCR_SKILL_NAME,
} from "./visionRouting";

describe("visionRouting", () => {
  it("adds hidden vision preflight without changing the main send model", () => {
    const currentOptions: MessageSendOptions = {
      memoryReferenceEnabled: true,
      model: "gpt-5.4",
    };

    const nextOptions = buildVisionSendOptions({
      currentOptions,
      selectedSkills: [{ name: FILE_TO_MARKDOWN_SKILL_NAME }],
      visionModelId: " qwen-vl-max ",
    });

    expect(nextOptions).toEqual({
      memoryReferenceEnabled: true,
      model: "gpt-5.4",
      visionPreflight: {
        mode: "file-to-markdown",
        model: "qwen-vl-max",
        skillName: FILE_TO_MARKDOWN_SKILL_NAME,
      },
    });
  });

  it("falls back to the built-in model for selected visual OCR preflight", () => {
    const nextOptions = buildVisionSendOptions({
      selectedSkills: [{ name: VISION_OCR_SKILL_NAME }],
      visionModelId: "",
    });

    expect(nextOptions).toEqual({
      visionPreflight: {
        mode: "ocr",
        model: DEFAULT_VISION_MODEL_ID,
        skillName: VISION_OCR_SKILL_NAME,
      },
    });
  });

  it("leaves non-vision sends untouched", () => {
    const currentOptions: MessageSendOptions = { model: "gpt-5.4" };

    const nextOptions = buildVisionSendOptions({
      currentOptions,
      selectedSkills: [{ name: "制作PPT" }],
      visionModelId: "qwen-vl-max",
    });

    expect(nextOptions).toBe(currentOptions);
  });

  it("normalizes empty configured model ids to the default model", () => {
    expect(resolveVisionModelId("   ")).toBe(DEFAULT_VISION_MODEL_ID);
  });

  it("detects Qwen VL models as image-capable and prefers flash over plus", () => {
    expect(inferVisionModelCapabilities("qwen3-vl-plus")).toEqual({
      imageInput: true,
    });
    expect(
      pickPreferredVisionModelId([
        { id: "deepseek-v4-pro" },
        { id: "qwen3-vl-plus" },
        { id: "qwen3-vl-flash" },
      ]),
    ).toBe("qwen3-vl-flash");
  });

  it("adds hidden vision preflight automatically when images are attached", () => {
    const nextOptions = buildVisionSendOptions({
      currentOptions: { model: "deepseek-v4-pro" },
      selectedSkills: [],
      visionModelId: "qwen3-vl-plus",
      hasImages: true,
    });

    expect(nextOptions).toEqual({
      model: "deepseek-v4-pro",
      visionPreflight: {
        mode: "ocr",
        model: "qwen3-vl-plus",
        skillName: VISION_OCR_SKILL_NAME,
      },
    });
  });

  it("adds hidden vision preflight automatically when visual files are referenced", () => {
    const nextOptions = buildVisionSendOptions({
      currentOptions: { model: "deepseek-v4-pro" },
      selectedSkills: [],
      visionModelId: "qwen3-vl-flash",
      hasVisualFiles: true,
    });

    expect(nextOptions).toEqual({
      model: "deepseek-v4-pro",
      visionPreflight: {
        mode: "ocr",
        model: "qwen3-vl-flash",
        skillName: VISION_OCR_SKILL_NAME,
      },
    });
  });
});
