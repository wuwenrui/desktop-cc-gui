import { describe, expect, it } from "vitest";
import {
  createFileEditorTypingDiagnosticsSession,
  createFileInteractionDiagnosticsSession,
} from "./fileEditorTypingDiagnostics";

describe("fileEditorTypingDiagnostics", () => {
  it("emits bounded content-safe proxy evidence", () => {
    const session = createFileEditorTypingDiagnosticsSession({
      workspaceId: "ws-1",
      filePath: "src/secret-value.ts",
      fileKind: "text",
      byteLength: 2048,
      lineCount: 42,
    });

    session.recordInput(2);
    session.recordInput(5);
    session.recordPublishedUpdate();
    session.recordTauriFileWrite();
    session.recordSelfSaveSuppression();

    const evidence = session.snapshot();

    expect(evidence).toMatchObject({
      source: "file-editor-typing",
      evidenceClass: "proxy",
      workspaceId: "ws-1",
      fileKind: "text",
      byteLengthBucket: "<=16384",
      lineCountBucket: "<=200",
      inputEventCount: 2,
      publishedUpdateCount: 1,
      tauriFileWriteCount: 1,
      clientStorageWriteCount: 0,
      selfSaveSuppressionCount: 1,
      editorTransactionDurationP95Ms: 5,
      visibleEchoLatencyP95Ms: null,
      longTaskCount: null,
    });
    expect(evidence.filePathHash).toMatch(/^fnv1a32:/);
    expect(JSON.stringify(evidence)).not.toContain("secret-value");
  });

  it("emits bounded content-safe file interaction evidence", () => {
    const session = createFileInteractionDiagnosticsSession({
      workspaceId: "ws-2",
      filePath: "src/private/customer-token.ts",
      fileKind: "typescript",
      interactionKind: "tab-activation",
      byteLength: 70_000,
      lineCount: 1_200,
    });

    session.recordStageDuration("read", 12.345);
    session.recordStageDuration("snapshot-ready", 18);
    session.recordStageDuration("first-useful-viewport", 24);
    session.recordStageDuration("heavy-preview", 88);
    session.recordTabActivation(true);
    session.recordEditorRemount();
    session.recordReactPublish();
    session.recordTauriRead();
    session.recordStaleWorkDrop();
    session.recordRealtimePressure();

    const evidence = session.snapshot();

    expect(evidence).toMatchObject({
      source: "file-interaction",
      interactionKind: "tab-activation",
      evidenceClass: "proxy",
      workspaceId: "ws-2",
      fileKind: "typescript",
      byteLengthBucket: "<=262144",
      lineCountBucket: "<=5000",
      readDurationMs: 12.35,
      snapshotReadyDurationMs: 18,
      firstUsefulViewportDurationMs: 24,
      heavyPreviewDurationMs: 88,
      tabActivationCount: 1,
      cachedSessionHitCount: 1,
      editorRemountCount: 1,
      reactPublishCount: 1,
      tauriReadCount: 1,
      tauriWriteCount: 0,
      staleWorkDropCount: 1,
      realtimePressureObserved: true,
    });
    expect(evidence.filePathHash).toMatch(/^fnv1a32:/);
    expect(JSON.stringify(evidence)).not.toContain("customer-token");
  });
});
