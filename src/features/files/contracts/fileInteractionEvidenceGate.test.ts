import { describe, expect, it } from "vitest";
import {
  createFileInteractionDiagnosticsSession,
  type FileInteractionKind,
  type FileInteractionStage,
} from "../utils/fileEditorTypingDiagnostics";

const REQUIRED_INTERACTION_KINDS: FileInteractionKind[] = [
  "file-open",
  "tab-activation",
  "typing",
  "line-change",
  "realtime-pressure",
];

const REQUIRED_STAGES: FileInteractionStage[] = [
  "read",
  "snapshot-ready",
  "first-useful-viewport",
  "heavy-preview",
];

describe("file interaction evidence gate", () => {
  it("covers every required interaction kind with content-safe evidence", () => {
    for (const interactionKind of REQUIRED_INTERACTION_KINDS) {
      const session = createFileInteractionDiagnosticsSession({
        workspaceId: "ws-evidence",
        filePath: `src/private-${interactionKind}.ts`,
        fileKind: "typescript",
        interactionKind,
        byteLength: 4096,
        lineCount: 120,
      });

      session.recordTabActivation(true);
      session.recordEditorRemount();
      session.recordReactPublish();
      session.recordTauriRead();
      session.recordTauriWrite();
      session.recordStaleWorkDrop();
      session.recordRealtimePressure();
      REQUIRED_STAGES.forEach((stage, index) => {
        session.recordStageDuration(stage, (index + 1) * 10);
      });

      const evidence = session.snapshot();

      expect(evidence).toMatchObject({
        source: "file-interaction",
        interactionKind,
        evidenceClass: "proxy",
        workspaceId: "ws-evidence",
        fileKind: "typescript",
        byteLengthBucket: "<=16384",
        lineCountBucket: "<=200",
        readDurationMs: 10,
        snapshotReadyDurationMs: 20,
        firstUsefulViewportDurationMs: 30,
        heavyPreviewDurationMs: 40,
        tabActivationCount: 1,
        cachedSessionHitCount: 1,
        editorRemountCount: 1,
        reactPublishCount: 1,
        tauriReadCount: 1,
        tauriWriteCount: 1,
        staleWorkDropCount: 1,
        realtimePressureObserved: true,
      });
      expect(evidence.filePathHash).toMatch(/^fnv1a32:/);
      expect(JSON.stringify(evidence)).not.toContain("private-");
    }
  });
});
