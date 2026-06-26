import { Component, type ErrorInfo, type ReactNode } from "react";
import { appendRendererDiagnostic } from "../../../services/rendererDiagnostics";

type ConversationRowErrorBoundaryProps = {
  children: ReactNode;
  rowKey: string;
  rowKind: string;
  contentHash?: string | null;
  renderWeight?: number | null;
  engine?: string | null;
  threadId?: string | null;
  workspaceId?: string | null;
  fallbackTitle: string;
  fallbackDescription: string;
  retryLabel: string;
  retryBlockedLabel?: string;
  maxRetryCount?: number;
};

type ConversationRowErrorBoundaryState = {
  hasError: boolean;
  retryCount: number;
};

function classifyStack(componentStack: string | null | undefined) {
  const stack = componentStack ?? "";
  if (stack.includes("Markdown")) {
    return "markdown";
  }
  if (stack.includes("Tool")) {
    return "tool-card";
  }
  if (stack.includes("Diff")) {
    return "diff";
  }
  if (stack.includes("MessageRow")) {
    return "message-row";
  }
  return "unknown";
}

function classifyError(error: Error) {
  if (
    error.message.includes("Maximum update depth exceeded") ||
    error.message.includes("Minified React error #185")
  ) {
    return "react-maximum-update-depth";
  }
  return error.name || "Error";
}

export class ConversationRowErrorBoundary extends Component<
  ConversationRowErrorBoundaryProps,
  ConversationRowErrorBoundaryState
> {
  state: ConversationRowErrorBoundaryState = {
    hasError: false,
    retryCount: 0,
  };

  static getDerivedStateFromError(): Partial<ConversationRowErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: ConversationRowErrorBoundaryProps) {
    if (
      previousProps.rowKey !== this.props.rowKey ||
      previousProps.contentHash !== this.props.contentHash
    ) {
      this.setState({ hasError: false, retryCount: 0 });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    appendRendererDiagnostic("messages/row-error-boundary", {
      surface: "conversation-row",
      workspaceId: this.props.workspaceId ?? null,
      threadId: this.props.threadId ?? null,
      engine: this.props.engine ?? null,
      rowKey: this.props.rowKey,
      rowKind: this.props.rowKind,
      renderWeight: this.props.renderWeight ?? null,
      errorClass: classifyError(error),
      stackClass: classifyStack(errorInfo.componentStack),
      retryCount: this.state.retryCount,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const maxRetryCount = this.props.maxRetryCount ?? 2;
    const retryBlocked = this.state.retryCount >= maxRetryCount;
    return (
      <div className="message-row-error-boundary" role="alert">
        <strong>{this.props.fallbackTitle}</strong>
        <span>{this.props.fallbackDescription}</span>
        <button
          type="button"
          className="ghost"
          disabled={retryBlocked}
          onClick={() => {
            if (retryBlocked) {
              return;
            }
            this.setState((state) => ({
              hasError: false,
              retryCount: state.retryCount + 1,
            }));
          }}
        >
          {retryBlocked
            ? this.props.retryBlockedLabel ?? this.props.retryLabel
            : this.props.retryLabel}
        </button>
      </div>
    );
  }
}
