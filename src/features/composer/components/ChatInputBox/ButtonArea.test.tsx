// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ButtonArea } from "./ButtonArea";

vi.mock("./selectors", () => ({
  ConfigSelect: () => <div data-testid="config-select" />,
  ModeSelect: () => <div data-testid="mode-select" />,
  ProviderSelect: () => <div data-testid="provider-select" />,
  ReasoningSelect: ({
    value,
    options,
    showDefaultOption,
    defaultLabel,
    onChange,
  }: {
    value: string | null;
    options?: string[];
    showDefaultOption?: boolean;
    defaultLabel?: string;
    onChange?: (value: string | null) => void;
  }) => (
    <div data-testid="reasoning-select">
      <span data-testid="reasoning-value">{value ?? ""}</span>
      <span data-testid="reasoning-options">{(options ?? []).join(",")}</span>
      <span data-testid="reasoning-default">{showDefaultOption ? defaultLabel : ""}</span>
      <button type="button" data-testid="reasoning-pick-high" onClick={() => onChange?.("high")}>
        high
      </button>
      <button type="button" data-testid="reasoning-pick-default" onClick={() => onChange?.(null)}>
        default
      </button>
    </div>
  ),
  ShortcutActionsSelect: () => <div data-testid="shortcut-actions-select" />,
}));

describe("ButtonArea custom model storage refresh", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders Claude reasoning selector with Claude default state", () => {
    render(
      <ButtonArea
        currentProvider="claude"
        models={[]}
        selectedModel=""
        reasoningEffort={null}
        reasoningOptions={["low", "medium", "high", "xhigh", "max"]}
        hasInputContent
        onSubmit={vi.fn()}
        onReasoningChange={vi.fn()}
        shortcutActions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    expect(screen.getByTestId("reasoning-select")).toBeTruthy();
    expect(screen.getByTestId("reasoning-value").textContent).toBe("");
    expect(screen.getByTestId("reasoning-options").textContent).toBe("low,medium,high,xhigh,max");
    expect(screen.getByTestId("reasoning-default").textContent).toBe("Claude 默认");
  });

  it("does not render reasoning selector for Gemini", () => {
    render(
      <ButtonArea
        currentProvider="gemini"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        onReasoningChange={vi.fn()}
        shortcutActions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    expect(screen.queryByTestId("reasoning-select")).toBeNull();
  });

  it("keeps the existing Codex reasoning selector without a default reset option", () => {
    render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        reasoningEffort="high"
        reasoningOptions={["medium", "high"]}
        hasInputContent
        onSubmit={vi.fn()}
        onReasoningChange={vi.fn()}
        shortcutActions={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    expect(screen.getByTestId("reasoning-select")).toBeTruthy();
    expect(screen.getByTestId("reasoning-value").textContent).toBe("high");
    expect(screen.getByTestId("reasoning-options").textContent).toBe("medium,high");
    expect(screen.getByTestId("reasoning-default").textContent).toBe("");
  });

  it("keeps secondary tools collapsed until the tool dock is opened", () => {
    const { container } = render(
      <ButtonArea
        currentProvider="claude"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        onProviderSelect={vi.fn()}
        onReasoningChange={vi.fn()}
        shortcutActions={[]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Expand or collapse input tools" });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.querySelector(".selector-tool-icon.codicon-extensions")).toBeTruthy();
    expect(container.querySelector(".selector-tool-dock-toggle")?.textContent).not.toContain("工具");
    expect(screen.queryByTestId("config-select")).toBeNull();
    expect(screen.queryByTestId("provider-select")).toBeNull();
    expect(screen.queryByTestId("reasoning-select")).toBeNull();
    expect(screen.queryByTestId("model-select")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("config-select")).toBeTruthy();
    expect(screen.queryByTestId("provider-select")).toBeNull();
    expect(screen.getByTestId("reasoning-select")).toBeTruthy();
    expect(
      toggle.compareDocumentPosition(screen.getByTestId("config-select")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the active provider tag before the send control", () => {
    const { container } = render(
      <ButtonArea
        currentProvider="codex"
        providerProfileLabel="codex-tui/openai"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
      />,
    );

    const providerTag = container.querySelector(".button-area-provider-tag");
    const sendButton = container.querySelector(".submit-button");

    expect(providerTag).toBeTruthy();
    expect(sendButton).toBeTruthy();
    if (!providerTag || !sendButton) {
      throw new Error("provider tag and send button should render");
    }
    expect(providerTag.textContent).toBe("codex-tui/openai");
    expect(providerTag.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the status panel toggle inside the opened tool dock", () => {
    const onToggleStatusPanel = vi.fn();

    render(
      <ButtonArea
        currentProvider="claude"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        panelToggleSurface={(
          <button
            type="button"
            className="selector-button button-area-status-panel-toggle"
            onClick={onToggleStatusPanel}
            aria-label="Collapse status panel"
          >
            <span className="codicon codicon-layers" />
          </button>
        )}
      />,
    );

    expect(screen.queryByRole("button", { name: "Collapse status panel" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));
    screen.getByRole("button", { name: "Collapse status panel" }).click();

    expect(onToggleStatusPanel).toHaveBeenCalledTimes(1);
  });

  it("collapses the bottom tool buttons from the main toggle and Escape", () => {
    render(
      <ButtonArea
        currentProvider="claude"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        onProviderSelect={vi.fn()}
        onReasoningChange={vi.fn()}
        shortcutActions={[]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Expand or collapse input tools" });

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("config-select")).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("config-select")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("places memory reference, reasoning, and token surface in visual order", () => {
    render(
      <ButtonArea
        currentProvider="claude"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        onReasoningChange={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="off"
        onSetMemoryReferenceMode={vi.fn()}
        mainSurface={<span data-testid="main-surface">token</span>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    const mainSurface = screen.getByTestId("main-surface");
    const reasoningSelect = screen.getByTestId("reasoning-select");
    const memoryReferenceToggle = screen.getByRole("button", { name: "composer.memoryReferenceToggle" });

    expect(memoryReferenceToggle.compareDocumentPosition(reasoningSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reasoningSelect.compareDocumentPosition(mainSurface) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("confirms single-send memory reference before enabling it", () => {
    const onSetMemoryReferenceMode = vi.fn();

    render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="off"
        onSetMemoryReferenceMode={onSetMemoryReferenceMode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    const toggle = screen.getByRole("button", { name: "composer.memoryReferenceToggle" });
    fireEvent.click(toggle);

    expect(onSetMemoryReferenceMode).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "composer.memoryReferenceEnableSingle" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "composer.memoryReferenceEnableAlways" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceEnableSingle" }));

    expect(onSetMemoryReferenceMode).toHaveBeenCalledWith("single");
    expect(screen.queryByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeNull();
  });

  it("renders the memory reference popover through a body portal", () => {
    const { container } = render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="off"
        onSetMemoryReferenceMode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));
    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceToggle" }));

    const dialog = screen.getByRole("dialog", { name: "composer.memoryReferenceDialogTitle" });

    expect(dialog.parentElement).toBe(document.body);
    expect(container.querySelector(".composer-memory-reference-popover")).toBeNull();
  });

  it("keeps memory reference action clicks stable before closing the popover", () => {
    const onSetMemoryReferenceMode = vi.fn();

    render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="off"
        onSetMemoryReferenceMode={onSetMemoryReferenceMode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));
    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceToggle" }));

    const alwaysButton = screen.getByRole("button", {
      name: "composer.memoryReferenceEnableAlways",
    });

    fireEvent.mouseDown(alwaysButton);
    fireEvent.click(alwaysButton);

    expect(onSetMemoryReferenceMode).toHaveBeenCalledWith("always");
    expect(screen.queryByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeNull();
  });

  it("closes the memory reference popover from outside click and Escape", () => {
    render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="off"
        onSetMemoryReferenceMode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));
    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceToggle" }));
    expect(screen.getByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceToggle" }));
    expect(screen.getByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeNull();
  });

  it("can enable always-on memory reference from the popover", () => {
    const onSetMemoryReferenceMode = vi.fn();

    render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="off"
        onSetMemoryReferenceMode={onSetMemoryReferenceMode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceToggle" }));
    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceEnableAlways" }));

    expect(onSetMemoryReferenceMode).toHaveBeenCalledWith("always");
    expect(screen.queryByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeNull();
  });

  it("turns off enabled memory reference directly from the icon", () => {
    const onSetMemoryReferenceMode = vi.fn();

    render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        hasInputContent
        onSubmit={vi.fn()}
        shortcutActions={[]}
        memoryReferenceMode="always"
        onSetMemoryReferenceMode={onSetMemoryReferenceMode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand or collapse input tools" }));

    fireEvent.click(screen.getByRole("button", { name: "composer.memoryReferenceToggle" }));

    expect(onSetMemoryReferenceMode).toHaveBeenCalledWith("off");
    expect(screen.queryByRole("dialog", { name: "composer.memoryReferenceDialogTitle" })).toBeNull();
  });

  it("keeps the stop action clickable while advisory stream phase changes", () => {
    const onStop = vi.fn();
    const { rerender } = render(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        disabled
        isLoading
        streamActivityPhase="waiting"
        hasInputContent={false}
        onStop={onStop}
        shortcutActions={[]}
      />,
    );

    const stopButton = screen.getByTitle("chat.stopGeneration") as HTMLButtonElement;
    expect(stopButton.disabled).toBe(false);
    expect(stopButton.dataset.streamPhase).toBe("waiting");

    rerender(
      <ButtonArea
        currentProvider="codex"
        models={[]}
        selectedModel=""
        disabled
        isLoading
        streamActivityPhase="ingress"
        hasInputContent={false}
        onStop={onStop}
        shortcutActions={[]}
      />,
    );

    fireEvent.click(screen.getByTitle("chat.stopGeneration"));

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle("chat.stopGeneration").dataset.streamPhase).toBe(
      "ingress",
    );
  });

});
