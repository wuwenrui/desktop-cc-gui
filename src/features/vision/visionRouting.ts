import type {
  MessageSendOptions,
  SkillOption,
  VisionPreflightMode,
} from "../../types";

export const DEFAULT_VISION_MODEL_ID = "qwen3-vl-flash";
export const FILE_TO_MARKDOWN_SKILL_NAME = "文件转Markdown";
export const VISION_OCR_SKILL_NAME = "视觉OCR";
const VISION_MODEL_DESCRIPTION = "Vision-capable model for OCR and image understanding.";

const VISION_SKILL_NAMES = new Set([
  FILE_TO_MARKDOWN_SKILL_NAME,
  VISION_OCR_SKILL_NAME,
  "OCR",
  "Vision OCR",
]);

type SkillLike = Pick<SkillOption, "name">;
export type VisionModelCapabilities = { imageInput?: boolean };
type ModelLike = {
  id: string;
  model?: string;
  label?: string;
  description?: string;
  capabilities?: Partial<VisionModelCapabilities> | null;
};

export function resolveVisionModelId(modelId?: string | null): string {
  const normalized = modelId?.trim() ?? "";
  return normalized || DEFAULT_VISION_MODEL_ID;
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[_/.:]+/g, "-");
}

export function inferVisionModelCapabilities(
  modelId?: string | null,
): VisionModelCapabilities | null {
  const normalized = normalizeModelId(modelId ?? "");
  if (!normalized) {
    return null;
  }
  const isQwenVl =
    normalized.includes("qwen") && /(^|-)vl($|-)/.test(normalized);
  const isNamedVision =
    normalized.includes("vision") ||
    normalized.includes("gpt-4o") ||
    normalized.includes("qvq");
  return isQwenVl || isNamedVision ? { imageInput: true } : null;
}

export function modelSupportsVision(model: ModelLike): boolean {
  return (
    model.capabilities?.imageInput === true ||
    inferVisionModelCapabilities(model.model ?? model.id)?.imageInput === true
  );
}

function visionModelRank(modelId: string): number {
  const normalized = normalizeModelId(modelId);
  if (normalized === DEFAULT_VISION_MODEL_ID) return 0;
  if (normalized === "qwen3-vl-plus") return 1;
  if (normalized.includes("qwen") && normalized.includes("vl-flash")) return 2;
  if (normalized.includes("qwen") && normalized.includes("vl-plus")) return 3;
  if (normalized.includes("qwen") && /(^|-)vl($|-)/.test(normalized)) return 4;
  if (normalized.includes("qvq")) return 5;
  if (normalized.includes("vision")) return 6;
  return 7;
}

export function markVisionModelCapabilities<T extends ModelLike>(model: T): T {
  const inferred = inferVisionModelCapabilities(model.model ?? model.id);
  if (!inferred) {
    return model;
  }
  return {
    ...model,
    capabilities: {
      ...(model.capabilities ?? {}),
      imageInput: true,
    },
    description: model.description?.trim() || VISION_MODEL_DESCRIPTION,
  };
}

export function pickPreferredVisionModelId(
  models: readonly ModelLike[],
  currentModelId?: string | null,
): string | null {
  const current = currentModelId?.trim();
  if (
    current &&
    models.some((model) => (model.model ?? model.id) === current && modelSupportsVision(model))
  ) {
    return current;
  }
  const candidates = models
    .filter(modelSupportsVision)
    .map((model) => model.model ?? model.id)
    .sort((left, right) => {
      const rankDiff = visionModelRank(left) - visionModelRank(right);
      return rankDiff !== 0 ? rankDiff : left.localeCompare(right);
    });
  return candidates[0] ?? null;
}

function resolveVisionPreflightMode(skillName: string): VisionPreflightMode {
  return skillName.trim() === FILE_TO_MARKDOWN_SKILL_NAME
    ? "file-to-markdown"
    : "ocr";
}

function resolveSelectedVisionSkill(selectedSkills: SkillLike[]): SkillLike | null {
  return (
    selectedSkills.find((skill) => VISION_SKILL_NAMES.has(skill.name.trim())) ??
    null
  );
}

export function hasSelectedVisionSkill(selectedSkills: SkillLike[]): boolean {
  return resolveSelectedVisionSkill(selectedSkills) !== null;
}

export function buildVisionSendOptions({
  currentOptions,
  selectedSkills,
  visionModelId,
  hasImages = false,
  hasVisualFiles = false,
  mainModelSupportsVision = false,
}: {
  currentOptions?: MessageSendOptions;
  selectedSkills: SkillLike[];
  visionModelId?: string | null;
  hasImages?: boolean;
  hasVisualFiles?: boolean;
  mainModelSupportsVision?: boolean;
}): MessageSendOptions | undefined {
  const selectedVisionSkill = resolveSelectedVisionSkill(selectedSkills);
  if (!selectedVisionSkill && !hasImages && !hasVisualFiles) {
    return currentOptions;
  }
  if (!selectedVisionSkill && mainModelSupportsVision) {
    return currentOptions;
  }
  const skillName = selectedVisionSkill?.name.trim() ?? VISION_OCR_SKILL_NAME;
  return {
    ...(currentOptions ?? {}),
    visionPreflight: {
      mode: resolveVisionPreflightMode(skillName),
      model: resolveVisionModelId(visionModelId),
      skillName,
    },
  };
}
