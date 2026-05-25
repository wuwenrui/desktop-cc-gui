import { vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  connectWorkspace,
  deleteCodexSession,
  deleteClaudeSession,
  deleteGeminiSession,
  deleteOpenCodeSession,
  getOpenCodeSessionList,
  listClaudeSessions,
  listGeminiSessions,
  listThreadTitles,
  listWorkspaceSessionArchiveEvidence,
  listWorkspaceSessions,
  loadGeminiSession,
  readWorkspaceFile,
  renameThreadTitleKey,
  setThreadTitle,
  trashWorkspaceItem,
  writeWorkspaceFile,
} from "../../../services/tauri";
import { mergeThreadItems, previewThreadName } from "../../../utils/threadItems";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";

vi.mock("../../../services/tauri", () => ({
  startThread: vi.fn(),
  connectWorkspace: vi.fn(),
  createWorkspaceDirectory: vi.fn(),
  forkClaudeSession: vi.fn(),
  forkClaudeSessionFromMessage: vi.fn(),
  forkThread: vi.fn(),
  rewindCodexThread: vi.fn(),
  listClaudeSessions: vi.fn(),
  listGeminiSessions: vi.fn(),
  getOpenCodeSessionList: vi.fn(),
  listWorkspaceSessions: vi.fn(),
  listWorkspaceSessionArchiveEvidence: vi.fn(),
  loadClaudeSession: vi.fn(),
  loadGeminiSession: vi.fn(),
  loadCodexSession: vi.fn(),
  listThreadTitles: vi.fn(),
  readWorkspaceFile: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  setThreadTitle: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
  deleteCodexSession: vi.fn(),
  deleteClaudeSession: vi.fn(),
  deleteGeminiSession: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  trashWorkspaceItem: vi.fn(),
  writeWorkspaceFile: vi.fn(),
}));

vi.mock("../../../utils/threadItems", () => ({
  buildItemsFromThread: vi.fn(),
  extractClaudeApprovalResumeEntries: vi.fn(() => []),
  getThreadTimestamp: vi.fn(),
  isReviewingFromThread: vi.fn(),
  mergeThreadItems: vi.fn(),
  normalizeItem: vi.fn((item: ConversationItem) => item),
  previewThreadName: vi.fn(),
  stripClaudeApprovalResumeArtifacts: vi.fn((text: string) => text),
}));

vi.mock("../utils/threadStorage", () => ({
  makeCustomNameKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
  saveThreadActivity: vi.fn(),
}));

vi.mock("../utils/sidebarSnapshot", () => ({
  loadSidebarSnapshot: vi.fn(() => null),
}));

vi.mock("../../../services/globalRuntimeNotices", async () => {
  const actual = await vi.importActual<typeof import("../../../services/globalRuntimeNotices")>(
    "../../../services/globalRuntimeNotices",
  );
  return actual;
});

export function resetUseThreadActionsTestMocks() {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.mocked(listThreadTitles).mockResolvedValue({});
  vi.mocked(listClaudeSessions).mockResolvedValue([]);
  vi.mocked(listGeminiSessions).mockResolvedValue([]);
  vi.mocked(getOpenCodeSessionList).mockResolvedValue([]);
  vi.mocked(listWorkspaceSessions).mockResolvedValue({
    data: [],
    nextCursor: null,
    partialSource: null,
  });
  vi.mocked(listWorkspaceSessionArchiveEvidence).mockResolvedValue({
    archivedAtBySessionId: {},
    partialSource: null,
    sourceStatuses: [],
  });
  vi.mocked(renameThreadTitleKey).mockResolvedValue(undefined);
  vi.mocked(setThreadTitle).mockResolvedValue("title");
  vi.mocked(connectWorkspace).mockResolvedValue(undefined);
  vi.mocked(previewThreadName).mockImplementation((text: string, fallback: string) => {
    const trimmed = text.trim();
    return trimmed || fallback;
  });
  vi.mocked(deleteClaudeSession).mockResolvedValue(undefined);
  vi.mocked(deleteGeminiSession).mockResolvedValue(undefined);
  vi.mocked(deleteOpenCodeSession).mockResolvedValue({
    deleted: true,
    method: "filesystem",
  });
  vi.mocked(deleteCodexSession).mockResolvedValue({
    deleted: true,
    deletedCount: 1,
    method: "filesystem",
    archivedBeforeDelete: true,
  });
  vi.mocked(loadGeminiSession).mockResolvedValue({ messages: [] });
  vi.mocked(readWorkspaceFile).mockResolvedValue({
    content: "",
    truncated: false,
  });
  vi.mocked(trashWorkspaceItem).mockResolvedValue(undefined);
  vi.mocked(writeWorkspaceFile).mockResolvedValue(undefined);
  vi.mocked(loadSidebarSnapshot).mockReturnValue(null);
  vi.mocked(mergeThreadItems).mockImplementation(
    (primaryItems: ConversationItem[]) => primaryItems,
  );
}
