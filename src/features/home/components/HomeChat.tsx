import { useDeferredValue, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  resolveWorkspaceVirtualItemKey,
  shouldVirtualizeWorkspaceList,
} from "./HomeChatVirtualization";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Folder from "lucide-react/dist/esm/icons/folder";
import FolderPlus from "lucide-react/dist/esm/icons/folder-plus";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Search from "lucide-react/dist/esm/icons/search";
import { useTranslation } from "react-i18next";
import type { EngineType } from "../../../types";
import type { WorkspaceKind } from "../../../types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { EngineIcon } from "../../engine/components/EngineIcon";

type LatestAgentRun = {
  message: string;
  timestamp: number;
  projectName: string;
  groupName?: string | null;
  workspaceId: string;
  threadId: string;
  isProcessing: boolean;
};

type HomeChatProps = {
  latestAgentRuns: LatestAgentRun[];
  isLoadingLatestAgents: boolean;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  workspaces: Array<{
    id: string;
    name: string;
    path?: string;
    kind?: WorkspaceKind;
    worktree?: {
      branch: string;
    } | null;
  }>;
  selectedWorkspaceId?: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onAddWorkspace?: () => void;
  composerNode?: ReactNode;
  selectedEngine?: EngineType;
  selectedBranchName?: string | null;
};

function getEngineLabel(engine: EngineType): string {
  switch (engine) {
    case "claude":
      return "Claude";
    case "gemini":
      return "Gemini";
    case "opencode":
      return "OpenCode";
    case "codex":
    default:
      return "Codex";
  }
}

export function HomeChat({
  latestAgentRuns,
  isLoadingLatestAgents,
  onSelectThread,
  workspaces,
  selectedWorkspaceId = null,
  onSelectWorkspace,
  onAddWorkspace,
  composerNode,
  selectedEngine = "codex",
  selectedBranchName = null,
}: HomeChatProps) {
  const { t } = useTranslation();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const workspacePanelId = useId();
  const workspaceSearchId = useId();
  const engineLabel = getEngineLabel(selectedEngine);
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId)
    ?? workspaces[0]
    ?? null;
  const deferredWorkspaceQuery = useDeferredValue(workspaceQuery.trim().toLowerCase());
  const filteredWorkspaces = deferredWorkspaceQuery.length === 0
    ? workspaces
    : workspaces.filter((workspace) => {
      const name = workspace.name.toLowerCase();
      const path = workspace.path?.toLowerCase() ?? "";
      return name.includes(deferredWorkspaceQuery) || path.includes(deferredWorkspaceQuery);
    });
  const workspaceListRef = useRef<HTMLDivElement | null>(null);
  const workspaceListHeightRef = useRef<number | null>(null);
  const shouldVirtualizeWorkspacePicker = shouldVirtualizeWorkspaceList(filteredWorkspaces.length);
  const workspaceListHeight =
    workspaceListHeightRef.current ?? Math.min(360, Math.max(48, filteredWorkspaces.length * 36));
  const workspaceVirtualizer = useVirtualizer({
    count: shouldVirtualizeWorkspacePicker ? filteredWorkspaces.length : 0,
    getScrollElement: () => workspaceListRef.current,
    estimateSize: () => 36,
    overscan: 8,
    getItemKey: (index) =>
      resolveWorkspaceVirtualItemKey(filteredWorkspaces, index),
  });
  useEffect(() => {
    if (!shouldVirtualizeWorkspacePicker) {
      workspaceListHeightRef.current = null;
      return;
    }
    workspaceListHeightRef.current = Math.min(
      360,
      Math.max(48, filteredWorkspaces.length * 36),
    );
  }, [filteredWorkspaces.length, shouldVirtualizeWorkspacePicker]);
  const branchLabel = selectedWorkspace
    ? selectedBranchName?.trim() || selectedWorkspace.worktree?.branch || null
    : null;
  const branchDescriptor = selectedWorkspace?.kind === "worktree"
    ? t("workspace.homeBranchLabelWorktree")
    : t("workspace.homeBranchLabelMain");
  const resolvedWorkspaceId = selectedWorkspace?.id ?? workspaces[0]?.id ?? "";
  useEffect(() => {
    if (!workspaceMenuOpen) {
      setWorkspaceQuery("");
      return;
    }

    searchInputRef.current?.focus();
  }, [workspaceMenuOpen]);

  function handleWorkspaceSelect(workspaceId: string) {
    onSelectWorkspace(workspaceId);
    setWorkspaceMenuOpen(false);
    setWorkspaceQuery("");
  }

  function handleAddWorkspace() {
    setWorkspaceMenuOpen(false);
    setWorkspaceQuery("");
    onAddWorkspace?.();
  }

  return (
    <div className="home-chat">
      <div className="home-chat-shell">
        <header className="home-chat-hero">
          <div
            className="home-chat-engine-mark"
            role="img"
            aria-label={engineLabel}
          >
            <EngineIcon
              engine={selectedEngine}
              size={50}
              className="home-chat-engine-icon"
            />
          </div>

          <div className="home-chat-headline">
            <h1 className="home-chat-title">
              {t("homeChat.minimalTitle", "Create anything")}
            </h1>

            {selectedWorkspace ? (
              <div
                className="home-chat-workspace-summary"
                title={selectedWorkspace.name}
              >
                <div className="home-chat-workspace-select" title={selectedWorkspace.name}>
                  <Popover open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="home-chat-workspace-select-trigger"
                        aria-label={t("homeChat.workspaceSelectLabel", "Workspace")}
                        aria-expanded={workspaceMenuOpen}
                        aria-controls={workspacePanelId}
                      >
                        <span className="home-chat-workspace-select-label">
                          {selectedWorkspace.name}
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden
                          className="home-chat-workspace-select-trigger-icon"
                          data-open={workspaceMenuOpen ? "true" : undefined}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      className="home-chat-workspace-picker-popover"
                      onOpenAutoFocus={(event) => event.preventDefault()}
                      side="bottom"
                      sideOffset={8}
                    >
                      <div className="home-chat-workspace-picker">
                        <label className="home-chat-workspace-picker-search" htmlFor={workspaceSearchId}>
                          <Search size={16} aria-hidden className="home-chat-workspace-picker-search-icon" />
                          <input
                            ref={searchInputRef}
                            id={workspaceSearchId}
                            type="text"
                            value={workspaceQuery}
                            onChange={(event) => setWorkspaceQuery(event.target.value)}
                            className="home-chat-workspace-picker-search-input"
                            placeholder={t("homeChat.workspaceSearchPlaceholder", "Search projects")}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>

                        <div
                          id={workspacePanelId}
                          ref={workspaceListRef}
                          className="home-chat-workspace-picker-list"
                          role="list"
                          aria-label={t("homeChat.workspaceSelectLabel", "Workspace")}
                          data-virtualized={shouldVirtualizeWorkspacePicker ? "true" : undefined}
                          style={
                            shouldVirtualizeWorkspacePicker
                              ? { maxHeight: `${workspaceListHeight}px` }
                              : undefined
                          }
                        >
                          {filteredWorkspaces.length > 0 ? (
                            shouldVirtualizeWorkspacePicker ? (
                              <div
                                className="home-chat-workspace-picker-virtual-spacer"
                                style={{ height: `${workspaceVirtualizer.getTotalSize()}px` }}
                              >
                                {workspaceVirtualizer.getVirtualItems().map((virtualRow) => {
                                  const workspace = filteredWorkspaces[virtualRow.index];
                                  if (!workspace) {
                                    return null;
                                  }
                                  const isSelected = workspace.id === resolvedWorkspaceId;
                                  return (
                                    <button
                                      key={virtualRow.key}
                                      type="button"
                                      className="home-chat-workspace-picker-item"
                                      data-selected={isSelected ? "true" : undefined}
                                      onClick={() => handleWorkspaceSelect(workspace.id)}
                                      style={{
                                        transform: `translateY(${virtualRow.start}px)`,
                                      }}
                                    >
                                      <Folder
                                        size={16}
                                        aria-hidden
                                        className="home-chat-workspace-picker-item-icon"
                                      />
                                      <span className="home-chat-workspace-picker-item-label">
                                        {workspace.name}
                                      </span>
                                      {isSelected ? (
                                        <Check
                                          size={16}
                                          aria-hidden
                                          className="home-chat-workspace-picker-item-check"
                                        />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              filteredWorkspaces.map((workspace) => {
                                const isSelected = workspace.id === resolvedWorkspaceId;

                                return (
                                  <button
                                    key={workspace.id}
                                    type="button"
                                    className="home-chat-workspace-picker-item"
                                    data-selected={isSelected ? "true" : undefined}
                                    onClick={() => handleWorkspaceSelect(workspace.id)}
                                  >
                                    <Folder
                                      size={16}
                                      aria-hidden
                                      className="home-chat-workspace-picker-item-icon"
                                    />
                                    <span className="home-chat-workspace-picker-item-label">
                                      {workspace.name}
                                    </span>
                                    {isSelected ? (
                                      <Check
                                        size={16}
                                        aria-hidden
                                        className="home-chat-workspace-picker-item-check"
                                      />
                                    ) : null}
                                  </button>
                                );
                              })
                            )
                          ) : (
                            <div className="home-chat-workspace-picker-empty">
                              {t("homeChat.workspaceNoMatch", "No projects found")}
                            </div>
                          )}
                        </div>

                        <div className="home-chat-workspace-picker-divider" />

                        <button
                          type="button"
                          className="home-chat-workspace-picker-add"
                          onClick={handleAddWorkspace}
                        >
                          <FolderPlus
                            size={16}
                            aria-hidden
                            className="home-chat-workspace-picker-add-icon"
                          />
                          <span>{t("homeChat.addWorkspaceAction", "Add new project")}</span>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {branchLabel ? (
                  <div className="home-chat-workspace-branch">
                    <GitBranch size={18} aria-hidden className="home-chat-workspace-branch-icon" />
                    <span className="home-chat-workspace-branch-label">{branchDescriptor}</span>
                    <span className="home-chat-workspace-branch-value">({branchLabel})</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        <section className="home-chat-stage">
          <section
            className="home-chat-composer-panel"
            aria-label={t("home.newConversation", "New Conversation")}
          >
            <div className="home-chat-composer-host">{composerNode}</div>
          </section>

          {latestAgentRuns.length > 0 || isLoadingLatestAgents ? (
            <section className="home-chat-recent-conversations" aria-label={t("homeChat.recentConversations", "Recent conversations")}>
              <span>{t("homeChat.recentConversations", "Recent conversations")}</span>
              {isLoadingLatestAgents ? (
                <span className="home-chat-recent-conversations-loading">
                  {t("homeChat.loadingRecentAgents", "Loading recent work")}
                </span>
              ) : null}
              {latestAgentRuns.map((run) => (
                <button
                  key={`${run.workspaceId}:${run.threadId}`}
                  type="button"
                  onClick={() => onSelectThread(run.workspaceId, run.threadId)}
                >
                  <span>{run.projectName}</span>
                  <span>{run.message}</span>
                </button>
              ))}
            </section>
          ) : null}
        </section>
      </div>
    </div>
  );
}
