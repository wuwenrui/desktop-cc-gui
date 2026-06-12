import type {
  MessageSendOptions,
  SkillOption,
  VisionPreflightMode,
} from "../../types";

export const DEFAULT_VISION_MODEL_ID = "qwen3-vl-flash";
export const FILE_TO_MARKDOWN_SKILL_NAME = "文件转Markdown";
export const VISION_OCR_SKILL_NAME = "视觉OCR";

const VISION_SKILL_NAMES = new Set([
  FILE_TO_MARKDOWN_SKILL_NAME,
  VISION_OCR_SKILL_NAME,
  "OCR",
  "Vision OCR",
]);

type SkillLike = Pick<SkillOption, "name">;

export function resolveVisionModelId(modelId?: string | null): string {
  const normalized = modelId?.trim() ?? "";
  return normalized || DEFAULT_VISION_MODEL_ID;
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
}: {
  currentOptions?: MessageSendOptions;
  selectedSkills: SkillLike[];
  visionModelId?: string | null;
}): MessageSendOptions | undefined {
  const selectedVisionSkill = resolveSelectedVisionSkill(selectedSkills);
  if (!selectedVisionSkill) {
    return currentOptions;
  }
  const skillName = selectedVisionSkill.name.trim();
  return {
    ...(currentOptions ?? {}),
    visionPreflight: {
      mode: resolveVisionPreflightMode(skillName),
      model: resolveVisionModelId(visionModelId),
      skillName,
    },
  };
}
