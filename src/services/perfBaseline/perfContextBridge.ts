// 轻量性能上下文桥。
//
// 目的:让掉帧 / 长任务采集器能在事件发生的那一刻,拿到"当时对话页在干什么"的上下文
// (是否正在流式、可见消息行数、最近一次用户交互)。这样导出的"卡顿现场"才能定位到
// 具体场景,而不是只有一个孤立的 deltaMs。
//
// 设计约束:纯 module 单例,不依赖 React,也不 import rendererDiagnostics(避免与
// frameDropMonitor 形成循环依赖)。所有写入都创建新对象,遵循项目不可变风格。

type PerfStreamingState = {
  isStreaming: boolean;
  streamActivityPhase: string | null;
  visibleRowCount: number | null;
};

type PerfInteraction = {
  label: string;
  at: number;
};

export type PerfContextSnapshot = {
  isStreaming: boolean;
  streamActivityPhase: string | null;
  visibleRowCount: number | null;
  lastInteractionLabel: string | null;
  lastInteractionAgoMs: number | null;
};

const EMPTY_STREAMING_STATE: PerfStreamingState = {
  isStreaming: false,
  streamActivityPhase: null,
  visibleRowCount: null,
};

let streamingState: PerfStreamingState = EMPTY_STREAMING_STATE;
let lastInteraction: PerfInteraction | null = null;
let detachInteractionTracking: (() => void) | null = null;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** 由对话页(Messages)在流式状态 / 可见行数变化时调用。 */
export function setPerfStreamingState(next: PerfStreamingState): void {
  streamingState = { ...next };
}

/** 记录最近一次用户交互标签,供掉帧现场附带"用户刚做了什么"。 */
export function notePerfInteraction(label: string): void {
  lastInteraction = { label, at: nowMs() };
}

/** 采集器在掉帧 / 长任务瞬间同步读取当前上下文快照。 */
export function readPerfContext(): PerfContextSnapshot {
  return {
    isStreaming: streamingState.isStreaming,
    streamActivityPhase: streamingState.streamActivityPhase,
    visibleRowCount: streamingState.visibleRowCount,
    lastInteractionLabel: lastInteraction?.label ?? null,
    lastInteractionAgoMs: lastInteraction
      ? Math.max(0, Math.round(nowMs() - lastInteraction.at))
      : null,
  };
}

/** 注册最近交互跟踪(passive + capture,开销可忽略)。幂等。 */
export function installPerfInteractionTracking(): void {
  if (detachInteractionTracking !== null || typeof window === "undefined") {
    return;
  }
  const bindings: Array<[keyof WindowEventMap, string]> = [
    ["pointerdown", "pointer"],
    ["keydown", "key"],
    ["wheel", "wheel"],
  ];
  const removers: Array<() => void> = [];
  for (const [type, label] of bindings) {
    const handler = () => notePerfInteraction(label);
    const options: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener(type, handler, options);
    removers.push(() =>
      window.removeEventListener(type, handler, { capture: true }),
    );
  }
  detachInteractionTracking = () => {
    for (const remove of removers) {
      remove();
    }
    detachInteractionTracking = null;
  };
}

/** 停止最近交互跟踪。幂等。 */
export function uninstallPerfInteractionTracking(): void {
  detachInteractionTracking?.();
}

export function __resetPerfContextBridgeForTests(): void {
  streamingState = EMPTY_STREAMING_STATE;
  lastInteraction = null;
  detachInteractionTracking?.();
}
