import { engineSendMessageSync } from "../../services/tauri";
import type { VisionPreflightOptions } from "../../types";

export const VISION_PREFLIGHT_AUTO_SESSION = {
  sessionPurpose: "vision-preflight",
  visibility: "hidden",
  ownerFeature: "vision",
  autoArchive: true,
  createdBy: "system",
} as const;

export type VisionPreflightResult = {
  mode: VisionPreflightOptions["mode"];
  model: string;
  skillName: string;
  imageCount: number;
  text: string;
};

function buildIsolatedVisionSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vision-preflight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildVisionPreflightPrompt({
  userText,
  preflight,
  imageCount,
}: {
  userText: string;
  preflight: VisionPreflightOptions;
  imageCount: number;
}): string {
  const task =
    preflight.mode === "file-to-markdown"
      ? "Convert the attached visual material into faithful Markdown."
      : "Perform OCR and visual understanding for the attached material.";
  return [
    "You are a hidden vision preprocessing worker.",
    task,
    "Return only the extracted result in Markdown.",
    "Preserve document order, headings, tables, labels, stamps, handwritten notes, and visible uncertainty.",
    "Do not answer the user's final request. Only provide visual/OCR evidence for the main model.",
    "",
    `Attached image count: ${imageCount}`,
    "User request:",
    userText,
  ].join("\n");
}

export function injectVisionPreflightContext(
  userText: string,
  result: VisionPreflightResult,
): string {
  const normalizedResult = result.text.trim();
  if (!normalizedResult) {
    return userText;
  }
  return [
    userText,
    "",
    "<hidden_vision_preflight_result>",
    `source_skill: ${result.skillName}`,
    `vision_model: ${result.model}`,
    `mode: ${result.mode}`,
    "",
    normalizedResult,
    "</hidden_vision_preflight_result>",
    "",
    "Use the hidden vision preflight result as evidence for the user's request. Do not mention the hidden preprocessing unless the user asks.",
  ].join("\n");
}

export async function runVisionPreflight({
  workspaceId,
  userText,
  images,
  preflight,
}: {
  workspaceId: string;
  userText: string;
  images: string[];
  preflight: VisionPreflightOptions;
}): Promise<VisionPreflightResult | null> {
  const normalizedImages = images
    .map((image) => image.trim())
    .filter((image) => image.length > 0);
  if (normalizedImages.length === 0) {
    return null;
  }
  const response = await engineSendMessageSync(workspaceId, {
    text: buildVisionPreflightPrompt({
      userText,
      preflight,
      imageCount: normalizedImages.length,
    }),
    engine: "claude",
    model: preflight.model,
    accessMode: "read-only",
    images: normalizedImages,
    continueSession: false,
    sessionId: buildIsolatedVisionSessionId(),
    autoSession: VISION_PREFLIGHT_AUTO_SESSION,
  });
  const text = response.text.trim();
  if (!text) {
    return null;
  }
  return {
    mode: preflight.mode,
    model: preflight.model,
    skillName: preflight.skillName,
    imageCount: normalizedImages.length,
    text,
  };
}
