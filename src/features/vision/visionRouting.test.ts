import { describe, expect, it } from "vitest";
import type { MessageSendOptions } from "../../types";
import {
  buildVisionSendOptions,
  DEFAULT_VISION_MODEL_ID,
  FILE_TO_MARKDOWN_SKILL_NAME,
  hasSelectedVisionSkill,
  inferVisionModelCapabilities,
  markVisionModelCapabilities,
  modelSupportsVision,
  pickPreferredVisionModelId,
  resolveVisionModelId,
  VISION_OCR_SKILL_NAME,
} from "./visionRouting";

describe("visionRouting", () => {
  describe("buildVisionSendOptions", () => {
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

    it("skips OCR preflight when main model supports vision and no skill is selected", () => {
      const currentOptions: MessageSendOptions = { model: "qwen3-vl-plus" };

      const nextOptions = buildVisionSendOptions({
        currentOptions,
        selectedSkills: [],
        visionModelId: "qwen3-vl-flash",
        hasImages: true,
        mainModelSupportsVision: true,
      });

      expect(nextOptions).toBe(currentOptions);
    });

    it("skips OCR preflight for visual files when main model supports vision", () => {
      const currentOptions: MessageSendOptions = { model: "claude-sonnet-4" };

      const nextOptions = buildVisionSendOptions({
        currentOptions,
        selectedSkills: [],
        visionModelId: "qwen3-vl-flash",
        hasVisualFiles: true,
        mainModelSupportsVision: true,
      });

      expect(nextOptions).toBe(currentOptions);
    });

    it("runs OCR preflight when user explicitly selects vision skill even if main model has vision", () => {
      const currentOptions: MessageSendOptions = { model: "qwen3-vl-plus" };

      const nextOptions = buildVisionSendOptions({
        currentOptions,
        selectedSkills: [{ name: VISION_OCR_SKILL_NAME }],
        visionModelId: "qwen3-vl-flash",
        hasImages: true,
        mainModelSupportsVision: true,
      });

      expect(nextOptions).toEqual({
        model: "qwen3-vl-plus",
        visionPreflight: {
          mode: "ocr",
          model: "qwen3-vl-flash",
          skillName: VISION_OCR_SKILL_NAME,
        },
      });
    });

    it("runs file-to-markdown preflight when user selects that skill even if main model has vision", () => {
      const nextOptions = buildVisionSendOptions({
        currentOptions: { model: "gpt-4o" },
        selectedSkills: [{ name: FILE_TO_MARKDOWN_SKILL_NAME }],
        visionModelId: "qwen3-vl-flash",
        hasVisualFiles: true,
        mainModelSupportsVision: true,
      });

      expect(nextOptions).toEqual({
        model: "gpt-4o",
        visionPreflight: {
          mode: "file-to-markdown",
          model: "qwen3-vl-flash",
          skillName: FILE_TO_MARKDOWN_SKILL_NAME,
        },
      });
    });

    it("triggers OCR preflight for non-vision main model with images", () => {
      const nextOptions = buildVisionSendOptions({
        currentOptions: { model: "deepseek-v4-pro" },
        selectedSkills: [],
        visionModelId: "qwen3-vl-flash",
        hasImages: true,
        mainModelSupportsVision: false,
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

    it("returns currentOptions unchanged when no images and no visual files regardless of vision support", () => {
      const currentOptions: MessageSendOptions = { model: "claude-sonnet-4" };

      expect(buildVisionSendOptions({
        currentOptions,
        selectedSkills: [],
        mainModelSupportsVision: true,
      })).toBe(currentOptions);

      expect(buildVisionSendOptions({
        currentOptions,
        selectedSkills: [],
        mainModelSupportsVision: false,
      })).toBe(currentOptions);
    });

    it("defaults mainModelSupportsVision to false when omitted", () => {
      const nextOptions = buildVisionSendOptions({
        selectedSkills: [],
        hasImages: true,
      });

      expect(nextOptions?.visionPreflight).toBeDefined();
    });
  });

  describe("resolveVisionModelId", () => {
    it("normalizes empty configured model ids to the default model", () => {
      expect(resolveVisionModelId("   ")).toBe(DEFAULT_VISION_MODEL_ID);
      expect(resolveVisionModelId(null)).toBe(DEFAULT_VISION_MODEL_ID);
      expect(resolveVisionModelId(undefined)).toBe(DEFAULT_VISION_MODEL_ID);
      expect(resolveVisionModelId("")).toBe(DEFAULT_VISION_MODEL_ID);
    });

    it("preserves a valid model id", () => {
      expect(resolveVisionModelId("qwen3-vl-plus")).toBe("qwen3-vl-plus");
    });
  });

  describe("inferVisionModelCapabilities", () => {
    it("detects Qwen VL models as image-capable", () => {
      expect(inferVisionModelCapabilities("qwen3-vl-plus")).toEqual({ imageInput: true });
      expect(inferVisionModelCapabilities("qwen3-vl-flash")).toEqual({ imageInput: true });
    });

    it("detects GPT-4o and QVQ as image-capable", () => {
      expect(inferVisionModelCapabilities("gpt-4o")).toEqual({ imageInput: true });
      expect(inferVisionModelCapabilities("qvq-72b")).toEqual({ imageInput: true });
    });

    it("detects vision-named models as image-capable", () => {
      expect(inferVisionModelCapabilities("some-vision-model")).toEqual({ imageInput: true });
    });

    it("returns null for non-vision models", () => {
      expect(inferVisionModelCapabilities("deepseek-v4-pro")).toBeNull();
      expect(inferVisionModelCapabilities("claude-sonnet-4")).toBeNull();
      expect(inferVisionModelCapabilities("")).toBeNull();
      expect(inferVisionModelCapabilities(null)).toBeNull();
    });
  });

  describe("modelSupportsVision", () => {
    it("returns true for models with explicit imageInput capability", () => {
      expect(modelSupportsVision({
        id: "claude-sonnet-4",
        capabilities: { imageInput: true },
      })).toBe(true);
    });

    it("returns true for models with inferable vision from model id", () => {
      expect(modelSupportsVision({ id: "qwen3-vl-flash" })).toBe(true);
      expect(modelSupportsVision({ id: "gpt-4o" })).toBe(true);
    });

    it("returns true when model field (not id) indicates vision", () => {
      expect(modelSupportsVision({ id: "custom-alias", model: "qwen3-vl-flash" })).toBe(true);
    });

    it("returns false for non-vision models without capability flag", () => {
      expect(modelSupportsVision({ id: "deepseek-v4-pro" })).toBe(false);
      expect(modelSupportsVision({ id: "claude-sonnet-4" })).toBe(false);
    });

    it("still returns true via name inference even when capability flag is false", () => {
      expect(modelSupportsVision({
        id: "qwen3-vl-flash",
        capabilities: { imageInput: false },
      })).toBe(true);
    });

    it("returns false only when both capability and name inference fail", () => {
      expect(modelSupportsVision({
        id: "deepseek-v4-pro",
        capabilities: { imageInput: false },
      })).toBe(false);
    });
  });

  describe("markVisionModelCapabilities", () => {
    it("adds imageInput capability to a vision-named model", () => {
      const model = { id: "qwen3-vl-flash", description: "" };
      const marked = markVisionModelCapabilities(model);
      expect(modelSupportsVision(marked)).toBe(true);
      expect(marked).not.toBe(model);
    });

    it("leaves non-vision models unchanged", () => {
      const model = { id: "deepseek-v4-pro", description: "fast" };
      expect(markVisionModelCapabilities(model)).toBe(model);
    });
  });

  describe("pickPreferredVisionModelId", () => {
    it("prefers flash over plus", () => {
      expect(
        pickPreferredVisionModelId([
          { id: "deepseek-v4-pro" },
          { id: "qwen3-vl-plus" },
          { id: "qwen3-vl-flash" },
        ]),
      ).toBe("qwen3-vl-flash");
    });

    it("returns current model if it supports vision", () => {
      expect(
        pickPreferredVisionModelId(
          [{ id: "qwen3-vl-plus" }, { id: "qwen3-vl-flash" }],
          "qwen3-vl-plus",
        ),
      ).toBe("qwen3-vl-plus");
    });

    it("returns null when no vision model is available", () => {
      expect(
        pickPreferredVisionModelId([{ id: "deepseek-v4-pro" }]),
      ).toBeNull();
    });
  });

  describe("hasSelectedVisionSkill", () => {
    it("detects selected vision skills", () => {
      expect(hasSelectedVisionSkill([{ name: VISION_OCR_SKILL_NAME }])).toBe(true);
      expect(hasSelectedVisionSkill([{ name: FILE_TO_MARKDOWN_SKILL_NAME }])).toBe(true);
      expect(hasSelectedVisionSkill([{ name: "OCR" }])).toBe(true);
      expect(hasSelectedVisionSkill([{ name: "Vision OCR" }])).toBe(true);
    });

    it("returns false for non-vision skills", () => {
      expect(hasSelectedVisionSkill([{ name: "制作PPT" }])).toBe(false);
      expect(hasSelectedVisionSkill([])).toBe(false);
    });
  });
});
