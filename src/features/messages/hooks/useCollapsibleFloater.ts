import { useCallback, useEffect, useRef, useState } from "react";

export type CollapsibleFloaterState = "collapsed" | "expanded-hover" | "pinned";

/**
 * Three-state floater with deterministic transitions:
 * - `collapsed` (default): only the entry button is visible.
 * - `expanded-hover`: panel is open; collapses on mouse-leave.
 * - `pinned`: panel stays open even when the cursor leaves.
 *
 * Hover-to-collapse is gated by a small grace period (default 200ms)
 * to prevent flicker when the cursor crosses a button edge.
 */
export function useCollapsibleFloater(hoverCollapseMs = 200) {
  const [state, setState] = useState<CollapsibleFloaterState>("collapsed");
  const leaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const expand = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setState((prev) => (prev === "expanded-hover" ? prev : "expanded-hover"));
  }, []);

  const scheduleCollapse = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      setState((prev) => (prev === "pinned" ? prev : "collapsed"));
      leaveTimerRef.current = null;
    }, hoverCollapseMs);
  }, [hoverCollapseMs]);

  const collapse = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setState((prev) => (prev === "pinned" ? prev : "collapsed"));
  }, []);

  const reset = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setState((prev) => (prev === "collapsed" ? prev : "collapsed"));
  }, []);

  const togglePin = useCallback(() => {
    setState((prev) => (prev === "pinned" ? "expanded-hover" : "pinned"));
  }, []);

  return { state, expand, scheduleCollapse, collapse, reset, togglePin };
}
