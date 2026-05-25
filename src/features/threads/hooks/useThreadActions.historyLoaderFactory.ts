import {
  loadCodexSession as loadCodexSessionService,
  loadClaudeSession as loadClaudeSessionService,
  loadGeminiSession as loadGeminiSessionService,
  resumeThread as resumeThreadService,
} from "../../../services/tauri";
import { createClaudeHistoryLoader } from "../loaders/claudeHistoryLoader";
import { createCodexHistoryLoader } from "../loaders/codexHistoryLoader";
import { createGeminiHistoryLoader } from "../loaders/geminiHistoryLoader";
import { createOpenCodeHistoryLoader } from "../loaders/opencodeHistoryLoader";
import { createSharedHistoryLoader } from "../loaders/sharedHistoryLoader";
import { loadSharedSession as loadSharedSessionService } from "../../shared-session/services/sharedSessions";

export function createThreadHistoryLoaderForThread({
  targetThreadId,
  workspaceId,
  workspacePath,
  preferLocalCodexHistory,
}: {
  targetThreadId: string;
  workspaceId: string;
  workspacePath: string | null;
  preferLocalCodexHistory: boolean;
}) {
  if (targetThreadId.startsWith("shared:")) {
    return createSharedHistoryLoader({
      workspaceId,
      loadSharedSession: loadSharedSessionService,
    });
  }
  if (targetThreadId.startsWith("claude:")) {
    return createClaudeHistoryLoader({
      workspaceId,
      workspacePath,
      loadClaudeSession: loadClaudeSessionService,
    });
  }
  if (targetThreadId.startsWith("gemini:")) {
    return createGeminiHistoryLoader({
      workspaceId,
      workspacePath,
      loadGeminiSession: loadGeminiSessionService,
    });
  }
  if (targetThreadId.startsWith("opencode:")) {
    return createOpenCodeHistoryLoader({
      workspaceId,
      resumeThread: resumeThreadService,
    });
  }
  return createCodexHistoryLoader({
    workspaceId,
    resumeThread: resumeThreadService,
    loadCodexSession: loadCodexSessionService,
    preferLocalHistory: preferLocalCodexHistory,
  });
}
