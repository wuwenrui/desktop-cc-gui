import { useDeferredValue, type ComponentProps } from "react";

import { Composer } from "../../composer/components/Composer";
import {
  shallowEqual,
  useActiveCanvasSelector,
  type ActiveCanvasSnapshot,
} from "./activeCanvasStore";

type ComposerProps = ComponentProps<typeof Composer>;

const selectActiveCanvasComposerProps = (
  snapshot: ActiveCanvasSnapshot,
): Pick<
  ComposerProps,
  | "items"
  | "activeThreadId"
  | "threadItemsByThread"
  | "threadStatusById"
  | "contextUsage"
  | "accountRateLimits"
  | "userInputRequests"
  | "isContextCompacting"
  | "codexCompactionLifecycleState"
  | "codexCompactionSource"
  | "codexCompactionCompletedAt"
  | "lastTokenUsageUpdatedAt"
> => ({
  items: snapshot.items,
  activeThreadId: snapshot.threadId,
  threadItemsByThread: snapshot.threadItemsByThread,
  threadStatusById: snapshot.threadStatusById,
  contextUsage: snapshot.activeTokenUsage,
  accountRateLimits: snapshot.activeRateLimits,
  userInputRequests: snapshot.userInputRequests,
  isContextCompacting:
    snapshot.activeThreadStatus?.isContextCompacting ??
    snapshot.isContextCompacting,
  codexCompactionLifecycleState:
    snapshot.activeThreadStatus?.codexCompactionLifecycleState ?? "idle",
  codexCompactionSource:
    snapshot.activeThreadStatus?.codexCompactionSource ?? null,
  codexCompactionCompletedAt:
    snapshot.activeThreadStatus?.codexCompactionCompletedAt ?? null,
  lastTokenUsageUpdatedAt:
    snapshot.activeThreadStatus?.lastTokenUsageUpdatedAt ?? null,
});

export function ActiveCanvasComposer(props: ComposerProps) {
  const activeCanvasComposerProps = useActiveCanvasSelector(
    selectActiveCanvasComposerProps,
    shallowEqual,
  );
  const deferredLiveProps = useDeferredValue(activeCanvasComposerProps);

  return <Composer {...props} {...deferredLiveProps} />;
}
