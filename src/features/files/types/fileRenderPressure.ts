export type FileRenderPressure = {
  engineProcessing: boolean;
  editorSplitChatVisible: boolean;
  activeSurface: "editor" | "detached-explorer" | "diff-review" | "other";
};

export const DEFAULT_FILE_RENDER_PRESSURE: FileRenderPressure = {
  engineProcessing: false,
  editorSplitChatVisible: false,
  activeSurface: "editor",
};

export function hasForegroundFileRenderPressure(pressure: FileRenderPressure) {
  return pressure.engineProcessing && pressure.editorSplitChatVisible;
}
