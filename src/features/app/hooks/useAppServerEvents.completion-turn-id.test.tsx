// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEvent } from "../../../types";
import {
  subscribeAppServerEvents,
  subscribeRawAppServerEvents,
} from "../../../services/events";
import { useAppServerEvents } from "./useAppServerEvents";

vi.mock("../../../services/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/events")>();
  return {
    ...actual,
    subscribeAppServerEvents: vi.fn(),
    subscribeRawAppServerEvents: vi.fn(),
  };
});

type Handlers = Parameters<typeof useAppServerEvents>[0];

function TestHarness({ handlers }: { handlers: Handlers }) {
  useAppServerEvents(handlers);
  return null;
}

let listener: ((event: AppServerEvent) => void) | null = null;
const unlisten = vi.fn();

beforeEach(() => {
  listener = null;
  unlisten.mockReset();
  vi.mocked(subscribeAppServerEvents).mockImplementation((callback) => {
    listener = callback;
    return unlisten;
  });
  vi.mocked(subscribeRawAppServerEvents).mockImplementation((callback) => {
    listener = callback;
    return unlisten;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function mount(handlers: Handlers) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<TestHarness handlers={handlers} />);
  });
  return { root };
}

async function deliver(event: AppServerEvent) {
  await act(async () => {
    listener?.(event);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useAppServerEvents completion turn identity", () => {
  it("passes normalized turn id from top-level turn/completed params", async () => {
    const handlers: Handlers = {
      onTurnCompleted: vi.fn(),
    };
    const { root } = await mount(handlers);

    await deliver({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "claude:session-1",
          turnId: "claude-turn-1",
          result: { text: "final response" },
          assistantFinalBoundary: true,
        },
      },
    });

    expect(handlers.onTurnCompleted).toHaveBeenCalledWith(
      "ws-1",
      "claude:session-1",
      "claude-turn-1",
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("prefers normalized top-level turn id over nested raw turn id on completion", async () => {
    const handlers: Handlers = {
      onTurnCompleted: vi.fn(),
    };
    const { root } = await mount(handlers);

    await deliver({
      workspace_id: "ws-1",
      message: {
        method: "turn/completed",
        params: {
          threadId: "claude:session-1",
          turnId: "claude-turn-normalized",
          turn: {
            id: "raw-engine-turn",
          },
          result: { text: "final response" },
          assistantFinalBoundary: true,
        },
      },
    });

    expect(handlers.onTurnCompleted).toHaveBeenCalledWith(
      "ws-1",
      "claude:session-1",
      "claude-turn-normalized",
    );

    await act(async () => {
      root.unmount();
    });
  });
});
