/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposerEditorSettings, CustomCommandOption, SkillOption } from "../../../types";
import { FILE_TO_MARKDOWN_SKILL_NAME } from "../../vision/visionRouting";
import { dispatchSelectSkill } from "../../lawhub/pptSkill";
import { Composer } from "./Composer";

vi.mock("../../../services/dragDrop", () => ({
  subscribeWindowDragDrop: vi.fn(() => () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `tauri://${path}`,
  invoke: vi.fn(async () => null),
}));

const visionFileInputMocks = vi.hoisted(() => ({
  collectVisionFilePaths: vi.fn((): string[] => []),
  collectVisionImageInputs: vi.fn(async (): Promise<string[]> => []),
}));

vi.mock("../../vision/visionFileInputs", () => visionFileInputMocks);

vi.mock("../../engine/components/EngineSelector", () => ({
  EngineSelector: () => null,
}));

vi.mock("../../opencode/components/OpenCodeControlPanel", () => ({
  OpenCodeControlPanel: () => null,
}));

vi.mock("./ChatInputBox/ChatInputBoxAdapter", () => ({
  ChatInputBoxAdapter: ({
    text,
    onTextChange,
    onSend,
  }: {
    text: string;
    onTextChange: (next: string, cursor: number | null) => void;
    onSend: () => void;
  }) => (
    <textarea
      value={text}
      onChange={(event) =>
        onTextChange(event.currentTarget.value, event.currentTarget.value.length)
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSend();
        }
      }}
    />
  ),
}));

type HarnessProps = {
  skills?: SkillOption[];
  commands?: CustomCommandOption[];
  onSend?: (text: string, images: string[], options?: unknown) => void;
  activeThreadId?: string;
  visionModelId?: string | null;
  attachedImages?: string[];
};

function ComposerHarness({
  skills = [],
  commands = [],
  onSend = () => {},
  activeThreadId = "thread-1",
  visionModelId = null,
  attachedImages = [],
}: HarnessProps) {
  const [draftText, setDraftText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const editorSettings: ComposerEditorSettings = {
    preset: "default",
    expandFenceOnSpace: false,
    expandFenceOnEnter: false,
    fenceLanguageTags: false,
    fenceWrapSelection: false,
    autoWrapPasteMultiline: false,
    autoWrapPasteCodeLike: false,
    continueListOnShiftEnter: false,
  };

  return (
    <Composer
      onSend={onSend}
      onQueue={() => {}}
      onStop={() => {}}
      canStop={false}
      isProcessing={false}
      steerEnabled={false}
      collaborationModes={[]}
      collaborationModesEnabled={true}
      selectedCollaborationModeId={null}
      onSelectCollaborationMode={() => {}}
      selectedEngine="claude"
      models={[]}
      selectedModelId={null}
      visionModelId={visionModelId}
      onSelectModel={() => {}}
      reasoningOptions={[]}
      selectedEffort={null}
      onSelectEffort={() => {}}
      reasoningSupported={false}
      accessMode="current"
      onSelectAccessMode={() => {}}
      skills={skills}
      prompts={[]}
      commands={commands}
      files={[]}
      draftText={draftText}
      onDraftChange={setDraftText}
      textareaRef={textareaRef}
      dictationEnabled={false}
      editorSettings={editorSettings}
      activeWorkspaceId="ws-1"
      activeThreadId={activeThreadId}
      attachedImages={attachedImages}
    />
  );
}

function getTextarea(container: HTMLElement) {
  const textarea = container.querySelector("textarea");
  if (!textarea) {
    throw new Error("Textarea not found");
  }
  return textarea as HTMLTextAreaElement;
}

describe("Composer context source grouping", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("avoids duplicated slash skill tokens when same skill name exists in multiple sources", async () => {
    const onSend = vi.fn();
    const view = render(
      <ComposerHarness
        onSend={onSend}
        skills={[
          {
            name: "doc-backup",
            path: "/repo/.claude/skills/doc-backup/SKILL.md",
            source: "global_claude",
            description: "claude",
          },
          {
            name: "doc-backup",
            path: "/repo/.codex/skills/doc-backup/SKILL.md",
            source: "global_codex",
            description: "codex",
          },
          {
            name: "doc-backup",
            path: "/repo/.agents/skills/doc-backup/SKILL.md",
            source: "global_agents",
            description: "agents",
          },
        ]}
      />,
    );

    const textarea = getTextarea(view.container);
    const value = "/doc-backup 帮我整理";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    const sentText = onSend.mock.calls[0]?.[0];
    expect(sentText).toBe("/doc-backup 帮我整理");
  });

  it("keeps slash token assembly clean without leaking source metadata", async () => {
    const onSend = vi.fn();
    const view = render(
      <ComposerHarness
        onSend={onSend}
        skills={[
          {
            name: "build-review",
            path: "/repo/.claude/skills/build-review/SKILL.md",
            source: "project_claude",
            description: "skill",
          },
        ]}
        commands={[
          {
            name: "team-lint",
            path: "/repo/.claude/commands/team/lint.md",
            source: "project_claude",
            description: "command",
            content: "body",
          },
        ]}
      />,
    );

    const textarea = getTextarea(view.container);
    const value = "/build-review /team-lint 检查一下";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    const sentText = onSend.mock.calls[0]?.[0];
    expect(sentText).toBe("/build-review /team-lint 检查一下");
    expect(sentText).not.toContain("project_claude");
    expect(sentText).not.toContain("User .claude");
  });

  it("clears selected skill chips when switching threads before sending", async () => {
    const onSend = vi.fn();
    const skill: SkillOption = {
      name: "review-code",
      path: "/repo/.claude/skills/review-code/SKILL.md",
      source: "project_claude",
      description: "review",
    };
    const view = render(
      <ComposerHarness
        onSend={onSend}
        skills={[skill]}
        activeThreadId="thread-1"
      />,
    );

    const textarea = getTextarea(view.container);
    const value = "/review-code 帮我看一下";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
    });

    view.rerender(
      <ComposerHarness
        onSend={onSend}
        skills={[skill]}
        activeThreadId="thread-2"
      />,
    );

    const switchedTextarea = getTextarea(view.container);
    await act(async () => {
      fireEvent.keyDown(switchedTextarea, { key: "Enter", bubbles: true });
    });

    expect(onSend.mock.calls[0]?.[0]).toBe("帮我看一下");
  });

  it("resolves a lawhub display name event to the real skill token", async () => {
    const onSend = vi.fn();
    const skill = {
      name: "civil-litigation-master",
      displayName: "民商事诉讼大师",
      path: "/repo/.claude/skills/civil-litigation-master/SKILL.md",
      source: "global_claude",
      description: "民商事案件诉讼流程",
    } as SkillOption;
    const view = render(<ComposerHarness onSend={onSend} skills={[skill]} />);

    await act(async () => {
      dispatchSelectSkill("民商事诉讼大师");
    });

    const textarea = getTextarea(view.container);
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: "起草起诉状",
          selectionStart: "起草起诉状".length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend.mock.calls[0]?.[0]).toBe(
      "/civil-litigation-master 起草起诉状",
    );
  });

  it("requests hidden vision preflight without overriding the main model", async () => {
    const onSend = vi.fn();
    const view = render(
      <ComposerHarness
        onSend={onSend}
        visionModelId="qwen-vl-max"
        skills={[
          {
            name: FILE_TO_MARKDOWN_SKILL_NAME,
            path: "/repo/skills/文件转Markdown.md",
            source: "bundled",
            description: "convert",
          },
        ]}
      />,
    );

    await act(async () => {
      dispatchSelectSkill(FILE_TO_MARKDOWN_SKILL_NAME);
    });

    const textarea = getTextarea(view.container);
    const value = "转换这个截图";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend.mock.calls[0]?.[2]).toEqual({
      visionPreflight: {
        mode: "file-to-markdown",
        model: "qwen-vl-max",
        skillName: FILE_TO_MARKDOWN_SKILL_NAME,
      },
    });
    expect(onSend.mock.calls[0]?.[2]).not.toHaveProperty("model");
  });

  it("requests hidden vision preflight automatically for image attachments", async () => {
    const onSend = vi.fn();
    const view = render(
      <ComposerHarness
        onSend={onSend}
        visionModelId="qwen3-vl-flash"
        attachedImages={["/tmp/evidence.png"]}
      />,
    );

    const textarea = getTextarea(view.container);
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value: "分析这张图里的证据",
          selectionStart: "分析这张图里的证据".length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    expect(onSend.mock.calls[0]?.[1]).toEqual(["/tmp/evidence.png"]);
    expect(onSend.mock.calls[0]?.[2]).toEqual({
      visionPreflight: {
        mode: "ocr",
        model: "qwen3-vl-flash",
        skillName: "视觉OCR",
      },
    });
  });

  it("converts referenced PDF files into hidden vision inputs before sending", async () => {
    visionFileInputMocks.collectVisionFilePaths.mockReturnValueOnce(["/tmp/report.pdf"]);
    visionFileInputMocks.collectVisionImageInputs.mockResolvedValueOnce([
      "data:image/png;base64,page-1",
    ]);
    const onSend = vi.fn();
    const view = render(
      <ComposerHarness onSend={onSend} visionModelId="qwen3-vl-flash" />,
    );

    const textarea = getTextarea(view.container);
    const value = "@file `/tmp/report.pdf`\n整理这个 PDF";
    await act(async () => {
      fireEvent.change(textarea, {
        target: {
          value,
          selectionStart: value.length,
        },
      });
      fireEvent.keyDown(textarea, { key: "Enter", bubbles: true });
    });

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(visionFileInputMocks.collectVisionImageInputs).toHaveBeenCalledWith({
      text: value,
      explicitPaths: [],
      workspacePath: null,
    });
    expect(onSend.mock.calls[0]?.[1]).toEqual(["data:image/png;base64,page-1"]);
    expect(onSend.mock.calls[0]?.[2]).toEqual({
      visionPreflight: {
        mode: "ocr",
        model: "qwen3-vl-flash",
        skillName: "视觉OCR",
      },
    });
  });
});
