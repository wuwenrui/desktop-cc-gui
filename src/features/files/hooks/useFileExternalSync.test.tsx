/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import {
  coalesceDetachedExternalFileChangeBatch,
  useFileExternalSync,
} from "./useFileExternalSync";
import { readWorkspaceFile } from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";

vi.mock("../../../services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useFileExternalSync", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

    it("coalesces batch watcher events by workspace and normalized path with latest event winning", () => {
      const batch = [
        {
          workspaceId: "ws-1",
          normalizedPath: "src/live.ts",
          eventKind: "modified",
          source: "watcher",
          detectedAtMs: 1,
        },
        {
          workspaceId: "ws-1",
          normalizedPath: "src/other.ts",
          eventKind: "modified",
          source: "watcher",
          detectedAtMs: 2,
        },
        {
          workspaceId: "ws-1",
          normalizedPath: "src/live.ts",
          eventKind: "modified",
          source: "watcher",
          detectedAtMs: 3,
        },
        {
          workspaceId: "ws-2",
          normalizedPath: "src/live.ts",
          eventKind: "modified",
          source: "watcher",
          detectedAtMs: 4,
        },
      ];

      const coalesced = coalesceDetachedExternalFileChangeBatch(batch, false);

      expect(coalesced.map((event) => event.detectedAtMs)).toEqual([3, 2, 4]);
    });

    it("coalesces watcher batch paths case-insensitively when requested", () => {
      const coalesced = coalesceDetachedExternalFileChangeBatch(
        [
          {
            workspaceId: "ws-1",
            normalizedPath: "SRC/Live.ts",
            eventKind: "modified",
            source: "watcher",
            detectedAtMs: 1,
          },
          {
            workspaceId: "ws-1",
            normalizedPath: "src/live.ts",
            eventKind: "modified",
            source: "watcher",
            detectedAtMs: 2,
          },
        ],
        true,
      );

      expect(coalesced).toHaveLength(1);
      expect(coalesced[0]?.detectedAtMs).toBe(2);
    });

    it("ignores stale polling refresh results after the file path changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T00:00:00Z"));
    const firstRead = createDeferred<{ content: string; truncated: boolean }>();
    vi.mocked(readWorkspaceFile)
      .mockImplementationOnce(() => firstRead.promise)
      .mockResolvedValue({ content: "fresh content", truncated: false });

    const { result, rerender } = renderHook(
      ({ filePath, workspaceRelativeFilePath }) => {
        const [content, setContent] = useState("initial content");
        const [truncated, setTruncated] = useState(false);
        const [previewSnapshotVersion, setPreviewSnapshotVersion] = useState(0);
        const savedContentRef = useRef(content);
        const latestIsDirtyRef = useRef(false);
        const isDirty = content !== savedContentRef.current;
        latestIsDirtyRef.current = isDirty;
        const externalDiskSnapshotRef = useRef<{ content: string; truncated: boolean } | null>({
          content,
          truncated,
        });

        const sync = useFileExternalSync({
          filePath,
          workspaceId: "ws-sync",
          workspaceRelativeFilePath,
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          isBinary: false,
          isDirty,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot: (value: string, nextTruncated: boolean) => {
            setContent(value);
            setTruncated(nextTruncated);
            setPreviewSnapshotVersion((version) => version + 1);
          },
          previewSnapshotVersion,
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });

        return {
          ...sync,
          content,
          truncated,
        };
      },
      {
        initialProps: {
          filePath: "src/first.ts",
          workspaceRelativeFilePath: "src/first.ts",
        },
      },
    );

    await act(async () => {
      vi.advanceTimersByTime(25);
      await Promise.resolve();
    });

    rerender({
      filePath: "src/second.ts",
      workspaceRelativeFilePath: "src/second.ts",
    });

    await act(async () => {
      firstRead.resolve({ content: "stale first content", truncated: false });
      await Promise.resolve();
    });

    expect(result.current.content).toBe("initial content");

    await act(async () => {
      vi.advanceTimersByTime(25);
      await Promise.resolve();
    });

      expect(result.current.content).toBe("fresh content");
      expect(vi.mocked(pushErrorToast)).not.toHaveBeenCalled();
    });

    it("does not overwrite dirty local content when an in-flight refresh resolves late", async () => {
      vi.useFakeTimers();
      vi.mocked(readWorkspaceFile).mockReset();
      const pendingRefresh = createDeferred<{
        content: string;
        truncated: boolean;
      }>();
      vi.mocked(readWorkspaceFile).mockImplementationOnce(
        () => pendingRefresh.promise,
      );

      const { result } = renderHook(() => {
        const [content, setContent] = useState("initial content");
        const [previewSnapshotVersion, setPreviewSnapshotVersion] = useState(0);
        const savedContentRef = useRef("initial content");
        const isDirty = content !== savedContentRef.current;
        const latestIsDirtyRef = useRef(isDirty);
        latestIsDirtyRef.current = isDirty;
        const externalDiskSnapshotRef = useRef<{
          content: string;
          truncated: boolean;
        } | null>({
          content: "initial content",
          truncated: false,
        });

        const sync = useFileExternalSync({
          filePath: "src/late-refresh.ts",
          workspaceId: "ws-sync",
          workspaceRelativeFilePath: "src/late-refresh.ts",
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          externalChangeApplyMode: "auto",
          isBinary: false,
          isDirty,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot: (value: string) => {
            setContent(value);
            setPreviewSnapshotVersion((version) => version + 1);
          },
          previewSnapshotVersion,
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });

        return {
          ...sync,
          content,
          setContent,
        };
      });

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });

      act(() => {
        result.current.setContent("local edit before refresh resolves");
      });

      await act(async () => {
        pendingRefresh.resolve({
          content: "late disk content",
          truncated: false,
        });
        await Promise.resolve();
      });

      expect(result.current.content).toBe("local edit before refresh resolves");
      expect(result.current.externalChangeConflict?.diskContent).toBe(
        "late disk content",
      );
      expect(result.current.externalPendingRefresh).toBeNull();
    });

    it("debounces clean auto-apply updates and keeps the latest disk snapshot", async () => {
      vi.useFakeTimers();
      vi.mocked(readWorkspaceFile)
        .mockResolvedValueOnce({ content: "disk update 1", truncated: false })
        .mockResolvedValue({ content: "disk update 2", truncated: false });

      const { result } = renderHook(() => {
        const [content, setContent] = useState("initial content");
        const [truncated, setTruncated] = useState(false);
        const [previewSnapshotVersion, setPreviewSnapshotVersion] = useState(0);
        const savedContentRef = useRef(content);
        const latestIsDirtyRef = useRef(false);
        const isDirty = content !== savedContentRef.current;
        latestIsDirtyRef.current = isDirty;
        const externalDiskSnapshotRef = useRef<{ content: string; truncated: boolean } | null>({
          content,
          truncated,
        });

        const sync = useFileExternalSync({
          filePath: "src/live.ts",
          workspaceId: "ws-sync",
          workspaceRelativeFilePath: "src/live.ts",
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          externalChangeApplyMode: "auto",
          externalChangeAutoApplyDebounceMs: 100,
          isBinary: false,
          isDirty,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot: (value: string, nextTruncated: boolean) => {
            setContent(value);
            setTruncated(nextTruncated);
            setPreviewSnapshotVersion((version) => version + 1);
          },
          previewSnapshotVersion,
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });

        return {
          ...sync,
          content,
          setContent,
        };
      });

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });
      expect(result.current.content).toBe("initial content");

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });
      expect(result.current.content).toBe("initial content");

      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(result.current.content).toBe("disk update 2");
    });

    it("promotes a debounced clean update to conflict when local edits start before apply", async () => {
      vi.useFakeTimers();
      vi.mocked(readWorkspaceFile).mockReset();
      vi.mocked(readWorkspaceFile)
        .mockResolvedValue({ content: "disk update", truncated: false });

      const { result } = renderHook(() => {
        const [content, setContent] = useState("initial content");
        const [previewSnapshotVersion, setPreviewSnapshotVersion] = useState(0);
        const savedContentRef = useRef("initial content");
        const isDirty = content !== savedContentRef.current;
        const latestIsDirtyRef = useRef(isDirty);
        latestIsDirtyRef.current = isDirty;
        const externalDiskSnapshotRef = useRef<{ content: string; truncated: boolean } | null>({
          content: "initial content",
          truncated: false,
        });

        const sync = useFileExternalSync({
          filePath: "src/live-dirty.ts",
          workspaceId: "ws-sync",
          workspaceRelativeFilePath: "src/live-dirty.ts",
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          externalChangeApplyMode: "auto",
          externalChangeAutoApplyDebounceMs: 100,
          isBinary: false,
          isDirty,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot: (value: string) => {
            setContent(value);
            setPreviewSnapshotVersion((version) => version + 1);
          },
          previewSnapshotVersion,
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });

        return {
          ...sync,
          content,
          setContent,
        };
      });

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });

      act(() => {
        result.current.setContent("local edit");
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(result.current.content).toBe("local edit");
      expect(result.current.externalChangeConflict?.diskContent).toBe("disk update");
      expect(result.current.externalPendingRefresh).toBeNull();
    });

    it("keeps clean auto updates pending while file render pressure is active", async () => {
      vi.useFakeTimers();
      vi.mocked(readWorkspaceFile).mockReset();
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "disk update under pressure",
        truncated: false,
      });

      const { result } = renderHook(() => {
        const [content, setContent] = useState("initial content");
        const [previewSnapshotVersion, setPreviewSnapshotVersion] = useState(0);
        const savedContentRef = useRef("initial content");
        const isDirty = content !== savedContentRef.current;
        const latestIsDirtyRef = useRef(isDirty);
        latestIsDirtyRef.current = isDirty;
        const externalDiskSnapshotRef = useRef<{ content: string; truncated: boolean } | null>({
          content: "initial content",
          truncated: false,
        });

        const sync = useFileExternalSync({
          filePath: "src/pressure.ts",
          workspaceId: "ws-sync",
          workspaceRelativeFilePath: "src/pressure.ts",
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          externalChangeApplyMode: "auto",
          isBinary: false,
          isDirty,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot: (value: string) => {
            setContent(value);
            setPreviewSnapshotVersion((version) => version + 1);
          },
          previewSnapshotVersion,
          fileRenderPressure: {
            engineProcessing: true,
            editorSplitChatVisible: true,
            activeSurface: "editor",
          },
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });

        return {
          ...sync,
          content,
        };
      });

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });

      expect(result.current.content).toBe("initial content");
      expect(result.current.externalPendingRefresh?.diskContent).toBe(
        "disk update under pressure",
      );
      expect(result.current.externalChangeConflict).toBeNull();
    });

    it("keeps a clean debounced update visible when the preview snapshot changes before auto-apply", async () => {
      vi.useFakeTimers();
      vi.mocked(readWorkspaceFile).mockReset();
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "disk update after snapshot change",
        truncated: false,
      });

      const { result } = renderHook(() => {
        const [content, setContent] = useState("initial content");
        const [previewSnapshotVersion, setPreviewSnapshotVersion] = useState(0);
        const savedContentRef = useRef("initial content");
        const isDirty = content !== savedContentRef.current;
        const latestIsDirtyRef = useRef(isDirty);
        latestIsDirtyRef.current = isDirty;
        const externalDiskSnapshotRef = useRef<{ content: string; truncated: boolean } | null>({
          content: "initial content",
          truncated: false,
        });

        const sync = useFileExternalSync({
          filePath: "src/debounced.ts",
          workspaceId: "ws-sync",
          workspaceRelativeFilePath: "src/debounced.ts",
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          externalChangeApplyMode: "auto",
          externalChangeAutoApplyDebounceMs: 100,
          isBinary: false,
          isDirty,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot: (value: string) => {
            setContent(value);
            setPreviewSnapshotVersion((version) => version + 1);
          },
          previewSnapshotVersion,
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });

        return {
          ...sync,
          content,
          bumpPreviewSnapshotVersion: () =>
            setPreviewSnapshotVersion((version) => version + 1),
        };
      });

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });

      act(() => {
        result.current.bumpPreviewSnapshotVersion();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(result.current.content).toBe("initial content");
      expect(result.current.externalPendingRefresh?.diskContent).toBe(
        "disk update after snapshot change",
      );

      act(() => {
        result.current.handleExternalApplyPendingRefresh();
      });

      expect(result.current.content).toBe("disk update after snapshot change");
      expect(result.current.externalChangeConflict).toBeNull();
      expect(result.current.externalPendingRefresh).toBeNull();
    });

    it("suppresses self-save watcher feedback when disk snapshot matches saved content", async () => {
      vi.useFakeTimers();
      vi.mocked(readWorkspaceFile).mockReset();
      vi.mocked(readWorkspaceFile).mockResolvedValue({
        content: "saved content",
        truncated: false,
      });
      const replaceDocumentSnapshot = vi.fn();

      const { result } = renderHook(() => {
        const savedContentRef = useRef("saved content");
        const latestIsDirtyRef = useRef(false);
        const externalDiskSnapshotRef = useRef<{ content: string; truncated: boolean } | null>({
          content: "saved content",
          truncated: false,
        });

        return useFileExternalSync({
          filePath: "src/self-save.ts",
          workspaceId: "ws-sync",
          workspaceRelativeFilePath: "src/self-save.ts",
          fileReadTargetDomain: "workspace",
          externalChangeMonitoringEnabled: true,
          externalChangeTransportMode: "polling",
          externalChangePollIntervalMs: 20,
          externalChangeApplyMode: "auto",
          isBinary: false,
          isDirty: false,
          isLoading: false,
          caseInsensitivePathCompare: false,
          replaceDocumentSnapshot,
          previewSnapshotVersion: 1,
          savedContentRef,
          latestIsDirtyRef,
          externalDiskSnapshotRef,
          autoSyncedMessage: "auto synced",
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(25);
        await Promise.resolve();
      });

      expect(readWorkspaceFile).toHaveBeenCalledWith("ws-sync", "src/self-save.ts");
      expect(replaceDocumentSnapshot).not.toHaveBeenCalled();
      expect(result.current.externalChangeConflict).toBeNull();
      expect(result.current.externalPendingRefresh).toBeNull();
      expect(result.current.externalChangeSyncState).toBe("in-sync");
    });
  });
