import { describe, expect, it } from "vitest";
import { createDomainEventGovernanceConsumer } from "./domainEventGovernanceConsumer";
import { domainEventFactories } from "./eventFactories";
import { createDomainEventRuntimeController } from "./eventRuntime";

const common = {
  occurredAt: "2026-05-20T00:00:00.000Z",
  workspaceId: "workspace-1",
  sessionId: "thread-1",
  engine: "codex" as const,
};

describe("domain event governance consumer", () => {
  it("keeps a bounded in-memory snapshot of terminal turn events", () => {
    const controller = createDomainEventRuntimeController();
    const consumer = createDomainEventGovernanceConsumer(controller.runtime);

    controller.emitInternal(domainEventFactories.turnStarted({ ...common, turnId: "turn-1" }));
    controller.emitInternal(
      domainEventFactories.turnCompleted({
        ...common,
        turnId: "turn-1",
        durationMs: 100,
      }),
    );
    controller.emitInternal(
      domainEventFactories.turnCompleted({
        ...common,
        turnId: "turn-1",
        durationMs: 100,
      }),
    );

    expect(consumer.getSnapshot().terminalTurnEvents).toEqual([
      expect.objectContaining({
        type: "turn.completed",
        turnId: "turn-1",
      }),
    ]);
  });

  it("keeps unsubscribe idempotent and stops receiving events", () => {
    const controller = createDomainEventRuntimeController();
    const consumer = createDomainEventGovernanceConsumer(controller.runtime);

    consumer.unsubscribe();
    consumer.unsubscribe();
    controller.emitInternal(
      domainEventFactories.turnFailed({
        ...common,
        turnId: "turn-2",
        errorMessage: "boom",
      }),
    );

    expect(consumer.getSnapshot().terminalTurnEvents).toEqual([]);
  });

  it("dedupes duplicate failed events without retaining listeners after unsubscribe", () => {
    const controller = createDomainEventRuntimeController();
    const consumer = createDomainEventGovernanceConsumer(controller.runtime);
    const failedEvent = domainEventFactories.turnFailed({
      ...common,
      turnId: "turn-3",
      errorMessage: "boom",
    });

    controller.emitInternal(failedEvent);
    controller.emitInternal(failedEvent);
    expect(consumer.getSnapshot().terminalTurnEvents).toHaveLength(1);

    consumer.unsubscribe();
    controller.emitInternal(
      domainEventFactories.turnCompleted({
        ...common,
        turnId: "turn-4",
        durationMs: 200,
      }),
    );

    expect(consumer.getSnapshot().terminalTurnEvents).toEqual([failedEvent]);
  });
});
