// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestUserInputRequest } from "../../../types";
import { RequestUserInputMessage } from "./RequestUserInputMessage";

const baseRequest: RequestUserInputRequest = {
  workspace_id: "ws-1",
  request_id: "req-1",
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    item_id: "item-1",
    questions: [
      {
        id: "q-1",
        header: "Question",
        question: "Provide input",
      },
    ],
  },
};

describe("RequestUserInputMessage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders secret questions as password input with visibility toggle", () => {
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "token",
            header: "Secret",
            question: "Paste token",
            isSecret: true,
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("approval.typeAnswerOptional");
    expect(input.getAttribute("type")).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(input.getAttribute("type")).toBe("text");
  });

  it("exposes a stable focus target for composer request pointers", () => {
    const { container } = render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    const card = container.querySelector(".request-user-input-card");
    expect(card?.getAttribute("tabindex")).toBe("-1");
    expect(card?.getAttribute("data-request-user-input-id")).toBe("req-1");
    expect(card?.getAttribute("data-workspace-id")).toBe("ws-1");
    expect(card?.getAttribute("data-thread-id")).toBe("thread-1");
  });

  it("shows submit error and keeps request on failure", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("fail"));
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));

    await waitFor(() => {
      expect(screen.getByText("Submit failed. Please retry.")).toBeTruthy();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "approval.submit" })).toBeTruthy();
  });

  it("collapses active request locally without settling the runtime prompt", () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse this question card without skipping" }));

    expect(screen.queryByText("Provide input")).toBeNull();
    expect(screen.getByRole("group", { name: "Collapsed question card" })).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Provide input")).toBeTruthy();
  });

  it("settles active request through skip handler without normal answer submit", async () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip this question and continue" }));

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith(baseRequest);
      expect(screen.queryByText("Provide input")).toBeNull();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("settles collapsed request through skip handler", async () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse this question card without skipping" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip this question and continue" }));

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith(baseRequest);
      expect(screen.queryByRole("group", { name: "Collapsed question card" })).toBeNull();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps request visible when skip settlement fails", async () => {
    const onSubmit = vi.fn();
    const onDismiss = vi.fn().mockRejectedValue(new Error("fail"));
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip this question and continue" }));

    await waitFor(() => {
      expect(screen.getByText("Submit failed. Please retry.")).toBeTruthy();
    });
    expect(onDismiss).toHaveBeenCalledWith(baseRequest);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Provide input")).toBeTruthy();
  });

  it("allows local collapse even when no runtime dismiss handler is provided", () => {
    const onSubmit = vi.fn();
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse this question card without skipping" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText("Provide input")).toBeNull();
  });

  it("auto-dismisses unanswered stale request after local timeout", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const onDismiss = vi.fn();
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("5:00")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    expect(onDismiss).toHaveBeenCalledWith(baseRequest, {
      staleSettlementHint: "timeout",
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText("Provide input")).toBeNull();
  });

  it("keeps timed-out request visible when auto-dismiss settlement fails", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const onDismiss = vi.fn().mockRejectedValue(new Error("fail"));
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    expect(onDismiss).toHaveBeenCalledWith(baseRequest, {
      staleSettlementHint: "timeout",
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Submit failed. Please retry.")).toBeTruthy();
    expect(screen.getByText("Provide input")).toBeTruthy();
  });

  it("does not repeat stale timeout dismiss after parent rerender keeps the same request", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <RequestUserInputMessage
        requests={[{ ...baseRequest }]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("submits timed-out active request with stale settlement hint", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      baseRequest,
      { answers: { "q-1": { answers: [] } } },
      { staleSettlementHint: "timeout" },
    );
  });

  it("keeps timeout hint when collapsed stale request is skipped after auto-dismiss failure", async () => {
    vi.useFakeTimers();
    const onDismiss = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(undefined);
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    expect(screen.getByText("Submit failed. Please retry.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse this question card without skipping" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Skip this question and continue" }));
      await Promise.resolve();
    });

    expect(onDismiss).toHaveBeenNthCalledWith(2, baseRequest, {
      staleSettlementHint: "timeout",
    });
    expect(screen.queryByRole("group", { name: "Collapsed question card" })).toBeNull();
  });

  it("does not auto-dismiss while a valid submit is in flight", async () => {
    vi.useFakeTimers();
    let resolveSubmit: (() => void) | null = null;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const onDismiss = vi.fn();
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      resolveSubmit?.();
      await Promise.resolve();
    });
  });

  it("keeps failed submit retryable even when timeout has already elapsed", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn().mockRejectedValue(new Error("fail"));
    const onDismiss = vi.fn();
    render(
      <RequestUserInputMessage
        requests={[baseRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Submit failed. Please retry.")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText("Provide input")).toBeTruthy();
  });

  it("preserves draft content when switching threads", () => {
    const threadARequest = baseRequest;
    const threadBRequest: RequestUserInputRequest = {
      ...baseRequest,
      request_id: "req-2",
      params: {
        ...baseRequest.params,
        thread_id: "thread-2",
        turn_id: "turn-2",
      },
    };

    const { rerender } = render(
      <RequestUserInputMessage
        requests={[threadARequest, threadBRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("approval.typeAnswerOptional");
    fireEvent.change(textarea, { target: { value: "thread-a-answer" } });

    rerender(
      <RequestUserInputMessage
        requests={[threadARequest, threadBRequest]}
        activeThreadId="thread-2"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    rerender(
      <RequestUserInputMessage
        requests={[threadARequest, threadBRequest]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    expect(
      (screen.getByPlaceholderText("approval.typeAnswerOptional") as HTMLTextAreaElement)
        .value,
    ).toBe("thread-a-answer");
  });

  it("shows one question at a time when multiple questions are pending", () => {
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-1",
            header: "Scope",
            question: "First question",
            options: [{ label: "A", description: "" }],
          },
          {
            id: "q-2",
            header: "Plan",
            question: "Second question",
            options: [{ label: "B", description: "" }],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: /1 Scope/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /2 Plan/ })).toBeTruthy();
    expect(screen.getByText("First question")).toBeTruthy();
    expect(screen.queryByText("Second question")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /2 Plan/ }));

    expect(screen.queryByText("First question")).toBeNull();
    expect(screen.getByText("Second question")).toBeTruthy();
  });

  it("submits empty answers when no questions are provided", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(request, { answers: {} });
    });
  });

  it("keeps FIFO order for same-thread requests after submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const requestA: RequestUserInputRequest = {
      ...baseRequest,
      request_id: "req-a",
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-a",
            header: "First",
            question: "First question",
          },
        ],
      },
    };
    const requestB: RequestUserInputRequest = {
      ...baseRequest,
      request_id: "req-b",
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-b",
            header: "Second",
            question: "Second question",
          },
        ],
      },
    };

    const { rerender } = render(
      <RequestUserInputMessage
        requests={[requestA, requestB]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("First question")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(requestA, { answers: { "q-a": { answers: [] } } });
    });

    rerender(
      <RequestUserInputMessage
        requests={[requestB]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("Second question")).toBeTruthy();
  });

  it("uses next until the last tab before submitting multi-question requests", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-1",
            header: "Project",
            question: "Choose project type",
            options: [{ label: "Docs", description: "" }],
          },
          {
            id: "q-2",
            header: "Output",
            question: "Choose output",
            options: [{ label: "Report", description: "" }],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("button", { name: "askUserQuestion.next" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "approval.submit" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "askUserQuestion.next" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Choose output")).toBeTruthy();
    expect(screen.getByRole("button", { name: "askUserQuestion.submit" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "askUserQuestion.submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(request, {
        answers: {
          "q-1": { answers: [] },
          "q-2": { answers: [] },
        },
      });
    });
  });

  it("preserves previous answers when skipping a later question", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-1",
            header: "Project",
            question: "Choose project type",
            options: [{ label: "Docs", description: "" }],
          },
          {
            id: "q-2",
            header: "Output",
            question: "Choose output",
            options: [{ label: "Report", description: "" }],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Docs" }));
    fireEvent.click(screen.getByRole("button", { name: "askUserQuestion.next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip this question and continue" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(request, {
        answers: {
          "q-1": { answers: ["Docs"] },
          "q-2": { answers: [] },
        },
        skippedQuestionIds: ["q-2"],
      });
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("allows deselecting a selected option by clicking it again", () => {
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-opt",
            header: "Age",
            question: "How old are you?",
            options: [
              { label: "18-25", description: "" },
              { label: "26-35", description: "" },
            ],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={vi.fn()}
      />,
    );

    const option = screen.getByRole("button", { name: "18-25" });
    fireEvent.click(option);
    expect(option.classList.contains("is-selected")).toBe(true);

    fireEvent.click(option);
    expect(option.classList.contains("is-selected")).toBe(false);
  });

  it("keeps duplicate option labels independently selectable", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-duplicate",
            header: "Duplicate",
            question: "Pick duplicate labels",
            multiSelect: true,
            options: [
              { label: "Same", description: "First" },
              { label: "Same", description: "Second" },
            ],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    const duplicateOptions = screen
      .getAllByText("Same")
      .map((node) => node.closest("button")!);
    fireEvent.click(duplicateOptions[0]);
    fireEvent.click(duplicateOptions[1]);

    expect(duplicateOptions[0].classList.contains("is-selected")).toBe(true);
    expect(duplicateOptions[1].classList.contains("is-selected")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(request, {
        answers: {
          "q-duplicate": {
            answers: ["Same", "Same"],
          },
        },
      });
    });
  });

  it("keeps selected option when notes are entered", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-opt",
            header: "Age",
            question: "How old are you?",
            options: [
              { label: "18-25", description: "" },
              { label: "26-35", description: "" },
            ],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    const option = screen.getByRole("button", { name: "18-25" });
    fireEvent.click(option);
    expect(option.classList.contains("is-selected")).toBe(true);

    const textarea = screen.getByPlaceholderText("approval.addNotesOptional");
    fireEvent.change(textarea, { target: { value: "再说吧" } });
    expect(option.classList.contains("is-selected")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(request, {
        answers: {
          "q-opt": {
            answers: ["18-25", "user_note: 再说吧"],
          },
        },
      });
    });
  });

  it("supports selecting multiple options when question is multiSelect", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const request: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        questions: [
          {
            id: "q-opt",
            header: "Focus",
            question: "Choose multiple",
            multiSelect: true,
            options: [
              { label: "性能优化", description: "" },
              { label: "代码质量", description: "" },
              { label: "安全性", description: "" },
            ],
          },
        ],
      },
    };

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />,
    );

    const optionA = screen.getByRole("button", { name: "性能优化" });
    const optionB = screen.getByRole("button", { name: "代码质量" });
    fireEvent.click(optionA);
    fireEvent.click(optionB);

    expect(optionA.classList.contains("is-selected")).toBe(true);
    expect(optionB.classList.contains("is-selected")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "approval.submit" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(request, {
        answers: {
          "q-opt": {
            answers: ["性能优化", "代码质量"],
          },
        },
      });
    });
  });
});
