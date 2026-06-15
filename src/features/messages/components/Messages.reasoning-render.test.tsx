// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

vi.mock("./Markdown", () => ({
  Markdown: ({
    className,
    value,
    onRenderedValueChange,
  }: {
    className?: string;
    value: string;
    onRenderedValueChange?: (value: string) => void;
  }) => {
    onRenderedValueChange?.(value);

    const blocks = value.split(/\n{2,}/).filter((block) => block.length > 0);
    const renderedBlocks: ReactElement[] = [];

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const blockLines = block.split(/\n+/);
      const isQuoteBlock = blockLines.every((line) => line.trim().startsWith(">"));

      if (!isQuoteBlock) {
        renderedBlocks.push(<p key={`${index}:${block}`}>{block}</p>);
        continue;
      }

      const quoteLines = [...blockLines];
      while (index + 1 < blocks.length) {
        const nextBlock = blocks[index + 1];
        const nextLines = nextBlock.split(/\n+/);
        const nextIsQuoteBlock = nextLines.every((line) => line.trim().startsWith(">"));
        if (!nextIsQuoteBlock) {
          break;
        }
        quoteLines.push(...nextLines);
        index += 1;
      }

      renderedBlocks.push(
        <blockquote key={`${index}:${block}`}>
          <p>
            {quoteLines
              .map((line) => line.replace(/^>\s?/, "").trim())
              .filter(Boolean)
              .join("")}
          </p>
        </blockquote>,
      );
    }

    return <div className={className}>{renderedBlocks}</div>;
  },
}));

describe("Messages reasoning render", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.removeItem("ccgui.messages.live.collapseMiddleSteps");
  });

  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  it("renders reasoning rows when there is reasoning body content", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-2",
        kind: "reasoning",
        summary: "Scanning repository\nLooking for entry points",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".thinking-block")).toBeTruthy();
    expect(container.querySelector(".reasoning-markdown-surface")).toBeTruthy();
    expect(container.querySelector(".reasoning-markdown")).toBeTruthy();
    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail?.textContent ?? "").toContain("Looking for entry points");
    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
  });

  it("collapses fragmented blockquote text in reasoning detail", () => {
    const fragmentedQuote = [
      "好",
      "的，让",
      "我",
      "帮你",
      "回",
      "顾一下当前项",
      "目的状态和",
      "最",
      "近的",
      "Git 操",
      "作。",
    ]
      .map((line) => `> ${line}`)
      .join("\n\n");

    const items: ConversationItem[] = [
      {
        id: "reasoning-fragmented-quote",
        kind: "reasoning",
        summary: "检查项目记忆",
        content: `从项目记忆里可以看到：\n\n${fragmentedQuote}`,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail).toBeTruthy();
    const quoteParagraphs = container.querySelectorAll(
      ".thinking-content blockquote p",
    );
    expect(quoteParagraphs.length).toBeGreaterThanOrEqual(1);
    expect(quoteParagraphs.length).toBeLessThanOrEqual(3);
    const text = reasoningDetail?.textContent ?? "";
    expect(text).toContain("好的，让我帮你回顾一下当前项目的状态和最近的Git 操作。");
  });

  it("dedupes overlapping reasoning summary and content text", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-overlap-1",
        kind: "reasoning",
        summary: "你好！有什么我可以帮你的吗？",
        content: "你好！有什么我可以帮你的吗？ 你好！有什么我可以帮你的吗？",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail).toBeTruthy();
    const text = (reasoningDetail?.textContent ?? "").replace(/\s+/g, "");
    const matches = text.match(/你好！有什么我可以帮你的吗？/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("dedupes reasoning summary and content when they share suffix clauses", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-overlap-suffix-1",
        kind: "reasoning",
        summary:
          "让我继续读取项目内规范文件和项目结构。现在我有了项目的概览信息。现在我对项目有了比较全面的了解。让我整理分析报告。",
        content:
          "ccgui 是一个基于 Tauri + React 的桌面应用，是 Cursor 的开源替代品，集成了多个 AI 编程引擎。现在我对项目有了比较全面的了解。让我整理分析报告。",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail).toBeTruthy();
    const text = (reasoningDetail?.textContent ?? "").replace(/\s+/g, "");
    const matches = text.match(/让我整理分析报告/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("strips duplicated reasoning title prefix from content body", () => {
    const title =
      "用户只是说“你好”，这是一个简单的问候。根据我的指导原则：1. 这是一个简单的交互，不需要使用工具。";
    const items: ConversationItem[] = [
      {
        id: "reasoning-title-prefix-1",
        kind: "reasoning",
        summary: title,
        content: `${title} 2. 我应该简洁友好地回应，并询问如何帮助。`,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail).toBeTruthy();
    const detailText = reasoningDetail?.textContent ?? "";
    const titleMatches = detailText.match(/用户只是说“你好”/g) ?? [];
    expect(titleMatches.length).toBe(0);
    expect(detailText).toContain("我应该简洁友好地回应，并询问如何帮助。");
  });

  it("preserves reasoning detail when summary is only a history preview prefix", () => {
    const fullText =
      "先检查项目目录结构和入口模块，再确认核心路由和状态来源，然后核对实时事件与历史回放链路，最后比对幕布渲染差异，确认是哪一步开始丢失思考正文。";
    const items: ConversationItem[] = [
      {
        id: "reasoning-history-preview-1",
        kind: "reasoning",
        summary: fullText.slice(0, 36),
        content: fullText,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail).toBeTruthy();
    expect((reasoningDetail?.textContent ?? "").replace(/\s+/g, "")).toContain(
      fullText.replace(/\s+/g, ""),
    );
  });

  it("preserves multiline reasoning detail when summary is only a preview prefix", () => {
    const fullText = [
      "先检查项目目录结构和入口模块，再确认核心路由和状态来源，",
      "然后核对实时事件与历史回放链路，",
      "最后比对幕布渲染差异，确认是哪一步开始丢失思考正文。",
    ].join("\n");
    const items: ConversationItem[] = [
      {
        id: "reasoning-history-preview-multiline-1",
        kind: "reasoning",
        summary: "先检查项目目录结构和入口模块，再确认核心路由和状态来源，",
        content: fullText,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail).toBeTruthy();
    expect((reasoningDetail?.textContent ?? "").replace(/\s+/g, "")).toContain(
      fullText.replace(/\s+/g, ""),
    );
  });

  it("dedupes adjacent duplicate reasoning blocks in history view", () => {
    const repeated =
      "用户问“你好你是 codex 吗”，这是一个简单的身份确认问题。根据系统提示，我需要：首先确认已读取规则。";
    const items: ConversationItem[] = [
      {
        id: "reasoning-history-1",
        kind: "reasoning",
        summary: repeated,
        content: repeated,
      },
      {
        id: "reasoning-history-2",
        kind: "reasoning",
        summary: repeated,
        content: repeated,
      },
      {
        id: "assistant-history-1",
        kind: "message",
        role: "assistant",
        text: "你好！",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
  });

  it("dedupes incremental claude reasoning snapshots even when titles evolve", () => {
    const step1 =
      "用户发送了“项目分析”这个简短请求。我需要先了解当前项目的上下文。";
    const step2 = `${step1}这是一个 worktree 目录。让我读取 package.json 和项目结构。`;
    const step3 = `${step2}现在我对项目有了完整的了解。`;
    const items: ConversationItem[] = [
      {
        id: "reasoning-snapshot-1",
        kind: "reasoning",
        summary: step1,
        content: step1,
      },
      {
        id: "reasoning-snapshot-2",
        kind: "reasoning",
        summary: step2,
        content: step2,
      },
      {
        id: "reasoning-snapshot-3",
        kind: "reasoning",
        summary: step3,
        content: step3,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
    expect(container.textContent ?? "").toContain("现在我对项目有了完整的了解");
  });

  it("collapses consecutive claude reasoning runs into a single visible block", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-run-1",
        kind: "reasoning",
        summary: "先读取 README 并识别技术栈",
        content: "先读取 README 并识别技术栈",
      },
      {
        id: "reasoning-run-2",
        kind: "reasoning",
        summary: "继续读取 CLAUDE.md 并整理结论",
        content: "继续读取 CLAUDE.md 并整理结论",
      },
      {
        id: "reasoning-run-3",
        kind: "reasoning",
        summary: "输出最终分析报告",
        content: "输出最终分析报告",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
    expect(container.textContent ?? "").toContain("先读取 README 并识别技术栈");
    expect(container.textContent ?? "").toContain("继续读取 CLAUDE.md 并整理结论");
    expect(container.textContent ?? "").toContain("输出最终分析报告");
  });

  it("collapses consecutive gemini reasoning runs into a single visible block", () => {
    const items: ConversationItem[] = [
      {
        id: "gemini-reasoning-run-1",
        kind: "reasoning",
        summary: "先读取 README 并识别技术栈",
        content: "先读取 README 并识别技术栈",
      },
      {
        id: "gemini-reasoning-run-2",
        kind: "reasoning",
        summary: "继续读取 CLAUDE.md 并整理结论",
        content: "继续读取 CLAUDE.md 并整理结论",
      },
      {
        id: "gemini-reasoning-run-3",
        kind: "reasoning",
        summary: "输出最终分析报告",
        content: "输出最终分析报告",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="gemini:thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="gemini"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
    expect(container.textContent ?? "").toContain("输出最终分析报告");
  });

  it("keeps segmented gemini reasoning slices visible during realtime rendering", () => {
    const items: ConversationItem[] = [
      {
        id: "gemini-reasoning-seg-1",
        kind: "reasoning",
        summary: "创建 operationlog 目录",
        content: "创建 operationlog 目录",
      },
      {
        id: "gemini-reasoning-seg-2",
        kind: "reasoning",
        summary: "编写 OperationLog.java",
        content: "编写 OperationLog.java",
      },
      {
        id: "gemini-reasoning-seg-3",
        kind: "reasoning",
        summary: "编写 OperationLogRequest.java",
        content: "编写 OperationLogRequest.java",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="gemini:thread-1"
        workspaceId="ws-1"
        isThinking
        activeEngine="gemini"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(3);
    expect(container.textContent ?? "").toContain("创建 operationlog 目录");
    expect(container.textContent ?? "").toContain("编写 OperationLog.java");
    expect(container.textContent ?? "").toContain("编写 OperationLogRequest.java");
  });

  it("collapses consecutive placeholder gemini segmented reasoning slices", () => {
    const items: ConversationItem[] = [
      {
        id: "gemini-placeholder-seg-1",
        kind: "reasoning",
        summary: "思考",
        content: "思考",
      },
      {
        id: "gemini-placeholder-seg-2",
        kind: "reasoning",
        summary: "思考",
        content: "思考",
      },
      {
        id: "gemini-placeholder-seg-3",
        kind: "reasoning",
        summary: "思考",
        content: "思考",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="gemini:thread-1"
        workspaceId="ws-1"
        isThinking
        activeEngine="gemini"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
  });

  it("keeps consecutive claude live reasoning runs segmented while streaming", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-live-run",
        kind: "reasoning",
        summary: "先读取 README 并识别技术栈",
        content: "先读取 README 并识别技术栈",
      },
      {
        id: "reasoning-live-run-seg-1",
        kind: "reasoning",
        summary: "继续读取 CLAUDE.md 并整理结论",
        content: "继续读取 CLAUDE.md 并整理结论",
      },
      {
        id: "reasoning-live-run-seg-2",
        kind: "reasoning",
        summary: "输出最终分析报告",
        content: "输出最终分析报告",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(3);
    expect(container.textContent ?? "").toContain("先读取 README 并识别技术栈");
    expect(container.textContent ?? "").toContain("继续读取 CLAUDE.md 并整理结论");
    expect(container.textContent ?? "").toContain("输出最终分析报告");
  });

  it("keeps first multiline claude reasoning content after collapsing runs", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-run-multiline-1",
        kind: "reasoning",
        summary: "分析计划\n先读取 README",
        content: "分析计划\n先读取 README",
      },
      {
        id: "reasoning-run-multiline-2",
        kind: "reasoning",
        summary: "继续分析\n再检查配置",
        content: "继续分析\n再检查配置",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
    const reasoningDetailText = container.querySelector(".thinking-content")?.textContent ?? "";
    expect(reasoningDetailText).toContain("先读取 README");
    expect(reasoningDetailText).toContain("再检查配置");
  });

  it("renders claude live reasoning at the bottom when dock mode is enabled", () => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "1");
    try {
      const items: ConversationItem[] = [
        {
          id: "claude-user-1",
          kind: "message",
          role: "user",
          text: "分析项目",
        },
        {
          id: "claude-live-reasoning-1",
          kind: "reasoning",
          summary: "正在分析",
          content: "先读取目录，再检查关键文件",
        },
      ];

      const { container } = render(
        <Messages
          items={items}
          threadId="claude:session-1"
          workspaceId="ws-1"
          isThinking
          activeEngine="claude"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const thinkingBlock = container.querySelector(".thinking-block");
      expect(thinkingBlock).toBeTruthy();
      expect(thinkingBlock?.textContent ?? "").toContain("先读取目录，再检查关键文件");
      expect(thinkingBlock?.nextElementSibling?.className ?? "").toContain("working");
    } finally {
      window.localStorage.removeItem("ccgui.claude.hideReasoningModule");
    }
  });

  it("keeps docked claude reasoning after turn completes and collapses it by default", () => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "1");
    try {
      const items: ConversationItem[] = [
        {
          id: "claude-user-2",
          kind: "message",
          role: "user",
          text: "继续分析项目",
        },
        {
          id: "claude-live-reasoning-2",
          kind: "reasoning",
          summary: "继续分析",
          content: "读取配置，再检查事件链路",
        },
        {
          id: "claude-live-reasoning-3",
          kind: "reasoning",
          summary: "补充分析",
          content: "定位线程事件顺序，核对状态同步",
        },
      ];

      const { container, rerender } = render(
        <Messages
          items={items}
          threadId="claude:session-2"
          workspaceId="ws-1"
          isThinking
          activeEngine="claude"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      expect(container.querySelectorAll(".thinking-block")).toHaveLength(2);
      const liveReasoningContents = container.querySelectorAll(".thinking-content");
      expect(liveReasoningContents[0]?.getAttribute("style") ?? "").toContain("display: none");
      expect(liveReasoningContents[1]?.getAttribute("style") ?? "").toContain("display: block");

      rerender(
        <Messages
          items={items}
          threadId="claude:session-2"
          workspaceId="ws-1"
          isThinking={false}
          activeEngine="claude"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const thinkingBlocks = container.querySelectorAll(".thinking-block");
      const reasoningDetails = container.querySelectorAll(".thinking-content");
      expect(thinkingBlocks).toHaveLength(2);
      expect(reasoningDetails[0]?.textContent ?? "").toContain("读取配置，再检查事件链路");
      expect(reasoningDetails[1]?.textContent ?? "").toContain("定位线程事件顺序，核对状态同步");
      expect(reasoningDetails[0]?.getAttribute("style") ?? "").toContain("display: none");
      expect(reasoningDetails[1]?.getAttribute("style") ?? "").toContain("display: none");
    } finally {
      window.localStorage.removeItem("ccgui.claude.hideReasoningModule");
    }
  });

  it("uses content for the reasoning title when summary is empty", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-content-title",
        kind: "reasoning",
        summary: "",
        content: "Plan from content\nMore detail here",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_500}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Plan from content");
    const reasoningDetail = container.querySelector(".thinking-content");
    expect(reasoningDetail?.textContent ?? "").toContain("More detail here");
    expect(reasoningDetail?.textContent ?? "").not.toContain("Plan from content");
  });

  it("does not show a stale reasoning label from a previous turn", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-old",
        kind: "reasoning",
        summary: "Old reasoning title",
        content: "",
      },
      {
        id: "assistant-msg",
        kind: "message",
        role: "assistant",
        text: "Previous assistant response",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    const label = workingText?.textContent ?? "";
    expect(label).toBeTruthy();
    expect(label).not.toContain("Old reasoning title");
    expect(label).toMatch(/Working|Generating response|messages\.generatingResponse/);
  });

  it("uses merged codex command summary for live activity and hides cwd-only detail", () => {
    const items: ConversationItem[] = [
      {
        id: "user-codex-command",
        kind: "message",
        role: "user",
        text: "检查状态",
      },
      {
        id: "tool-codex-command",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status --short",
        detail: "/Users/chenxiangning/code/AI/reach/ai-reach",
        status: "in_progress",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const activity = container.querySelector(".working-activity");
    expect(activity?.textContent ?? "").toContain("git status --short");
    expect(activity?.textContent ?? "").not.toContain("/Users/chenxiangning/code/AI/reach/ai-reach");
  });

  it("hides codex encrypted-only reasoning cards without affecting assistant output", () => {
    const items: ConversationItem[] = [
      {
        id: "user-codex-encrypted-reasoning",
        kind: "message",
        role: "user",
        text: "看看当前状态",
      },
      {
        id: "reasoning-codex-encrypted",
        kind: "reasoning",
        summary: "Encrypted reasoning",
        content: "",
      },
      {
        id: "assistant-codex-encrypted-reasoning",
        kind: "message",
        role: "assistant",
        text: "这里是正常回答。",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-codex-encrypted-reasoning"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(screen.getByText("这里是正常回答。")).toBeTruthy();
  });
});
