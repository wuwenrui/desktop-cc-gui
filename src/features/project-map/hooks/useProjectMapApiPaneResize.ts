import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

const API_LEFT_PANE_DEFAULT_WIDTH = 20;
const API_RIGHT_PANE_DEFAULT_WIDTH = 60;
const API_LEFT_PANE_MIN_WIDTH = 16;
const API_LEFT_PANE_MAX_WIDTH = 30;
const API_RIGHT_PANE_MIN_WIDTH = 34;
const API_RIGHT_PANE_MAX_WIDTH = 68;

function clampApiPaneWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useProjectMapApiPaneResize(relationshipGraphZoom: number) {
  const apiContractWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [apiLeftPaneWidth, setApiLeftPaneWidth] = useState(API_LEFT_PANE_DEFAULT_WIDTH);
  const [apiRightPaneWidth, setApiRightPaneWidth] = useState<number | null>(null);
  const apiPaneResizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      apiPaneResizeCleanupRef.current?.();
      apiPaneResizeCleanupRef.current = null;
    };
  }, []);

  const apiPaneStyle = {
    "--relationship-graph-scale": relationshipGraphZoom,
    "--api-left-pane-width": `${apiLeftPaneWidth}%`,
    ...(apiRightPaneWidth === null ? {} : { "--api-right-pane-width": `${apiRightPaneWidth}%` }),
  } as CSSProperties;

  const beginApiPaneResize = useCallback((
    pane: "left" | "right",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const workspaceRect = apiContractWorkspaceRef.current?.getBoundingClientRect();
    const workspaceWidth = workspaceRect?.width ?? 0;
    if (!workspaceWidth || !Number.isFinite(workspaceWidth)) {
      return;
    }

    apiPaneResizeCleanupRef.current?.();
    apiPaneResizeCleanupRef.current = null;

    const startX = event.clientX;
    const startLeftWidth = apiLeftPaneWidth;
    const startRightWidth = apiRightPaneWidth ?? API_RIGHT_PANE_DEFAULT_WIDTH;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const deltaPercent = delta / workspaceWidth * 100;
      if (pane === "left") {
        setApiLeftPaneWidth(clampApiPaneWidth(
          startLeftWidth + deltaPercent,
          API_LEFT_PANE_MIN_WIDTH,
          API_LEFT_PANE_MAX_WIDTH,
        ));
        return;
      }
      setApiRightPaneWidth(clampApiPaneWidth(
        startRightWidth - deltaPercent,
        API_RIGHT_PANE_MIN_WIDTH,
        API_RIGHT_PANE_MAX_WIDTH,
      ));
    };
    const cleanupResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      apiPaneResizeCleanupRef.current = null;
    };
    const handlePointerUp = () => {
      cleanupResize();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    apiPaneResizeCleanupRef.current = cleanupResize;
  }, [apiLeftPaneWidth, apiRightPaneWidth]);

  return {
    apiContractWorkspaceRef,
    apiPaneStyle,
    beginApiPaneResize,
  };
}
