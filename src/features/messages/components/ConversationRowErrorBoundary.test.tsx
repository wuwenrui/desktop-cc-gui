// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationRowErrorBoundary } from "./ConversationRowErrorBoundary";

const rendererDiagnosticMocks = vi.hoisted(() => ({
  appendRendererDiagnostic: vi.fn(),
}));

vi.mock("../../../services/rendererDiagnostics", () => rendererDiagnosticMocks);

function ThrowingRow(): ReactElement {
  throw new Error("SECRET_SHOULD_NOT_LEAK");
}

function MaximumDepthThrowingRow(): ReactElement {
  throw new Error("Maximum update depth exceeded");
}

describe("ConversationRowErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rendererDiagnosticMocks.appendRendererDiagnostic.mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
  });

  it("contains a row render failure without unmounting siblings", () => {
    render(
      <div>
        <ConversationRowErrorBoundary
          rowKey="row-1"
          rowKind="entry"
          contentHash="hash-1"
          renderWeight={120}
          engine="codex"
          threadId="thread-1"
          workspaceId="workspace-1"
          fallbackTitle="Row failed"
          fallbackDescription="Other rows remain available."
          retryLabel="Retry row"
        >
          <ThrowingRow />
        </ConversationRowErrorBoundary>
        <div>Sibling row still mounted</div>
      </div>,
    );

    expect(screen.getByText("Row failed")).toBeTruthy();
    expect(screen.getByText("Sibling row still mounted")).toBeTruthy();
    expect(rendererDiagnosticMocks.appendRendererDiagnostic).toHaveBeenCalledWith(
      "messages/row-error-boundary",
      expect.objectContaining({
        surface: "conversation-row",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        engine: "codex",
        rowKey: "row-1",
        rowKind: "entry",
        renderWeight: 120,
        errorClass: "Error",
      }),
    );
    const [, payload] = rendererDiagnosticMocks.appendRendererDiagnostic.mock.calls[0] ?? [];
    expect(JSON.stringify(payload)).not.toContain("SECRET_SHOULD_NOT_LEAK");
  });

  it("allows retrying a failed row", () => {
    let shouldThrow = true;
    function RetryableRow() {
      if (shouldThrow) {
        throw new Error("temporary render failure");
      }
      return <div>Recovered row</div>;
    }

    render(
      <ConversationRowErrorBoundary
        rowKey="row-2"
        rowKind="entry"
        contentHash="hash-2"
        fallbackTitle="Row failed"
        fallbackDescription="Other rows remain available."
        retryLabel="Retry row"
      >
        <RetryableRow />
      </ConversationRowErrorBoundary>,
    );

    shouldThrow = false;
    fireEvent.click(screen.getByText("Retry row"));

    expect(screen.getByText("Recovered row")).toBeTruthy();
  });

  it("classifies maximum-update-depth style failures without raw content", () => {
    render(
      <ConversationRowErrorBoundary
        rowKey="row-3"
        rowKind="entry"
        contentHash="hash-3"
        renderWeight={200}
        engine="claude"
        fallbackTitle="Row failed"
        fallbackDescription="Other rows remain available."
        retryLabel="Retry row"
      >
        <MaximumDepthThrowingRow />
      </ConversationRowErrorBoundary>,
    );

    const [, payload] = rendererDiagnosticMocks.appendRendererDiagnostic.mock.calls[0] ?? [];
    expect(payload).toEqual(
      expect.objectContaining({
        errorClass: "react-maximum-update-depth",
        engine: "claude",
        renderWeight: 200,
        surface: "conversation-row",
      }),
    );
    expect(JSON.stringify(payload)).not.toContain("Maximum update depth exceeded");
  });

  it("blocks repeated retries after the local limit", () => {
    render(
      <ConversationRowErrorBoundary
        rowKey="row-4"
        rowKind="entry"
        contentHash="hash-4"
        fallbackTitle="Row failed"
        fallbackDescription="Other rows remain available."
        retryLabel="Retry row"
        retryBlockedLabel="Retry blocked"
        maxRetryCount={1}
      >
        <ThrowingRow />
      </ConversationRowErrorBoundary>,
    );

    fireEvent.click(screen.getByText("Retry row"));

    const blockedButton = screen.getByText("Retry blocked") as HTMLButtonElement;
    expect(blockedButton.disabled).toBe(true);
  });
});
