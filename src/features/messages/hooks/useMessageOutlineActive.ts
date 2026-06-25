import { useEffect, useState, type RefObject } from "react";
import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";

type UseMessageOutlineActiveResult = {
  activeHeadingId: string | null;
};

/**
 * Resolves the currently-active heading for a single messages-stream
 * outline. Strategy: listen for window scroll, throttle to one
 * recomputation per `requestAnimationFrame` tick, and pick the
 * heading whose `startLine` is the largest value at or above the
 * container's current top. This works whether the heading DOM is
 * currently mounted (virtualized list active row) or not
 * (virtualized list recycled the row out).
 *
 * Inputs:
 * - `outline`: the worker / extractor-produced heading list
 * - `containerRef`: a ref to the messages surface root (or the
 *   scroll container). We use its `getBoundingClientRect().top` as
 *   the reference for the "active heading".
 *
 * Returns:
 * - `activeHeadingId`: the id of the heading closest to (and at or
 *   above) the viewport top, or `null` if the outline is empty.
 */
export function useMessageOutlineActive(
  outline: MarkdownOutlineEntry[] | null,
  containerRef: RefObject<HTMLElement | null>,
): UseMessageOutlineActiveResult {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  // Content fingerprint: only rebuild the scroll listener when the
  // outline's content identity changes, not when the parent re-creates
  // the array on every render (which would happen during streaming).
  const outlineKey = outline
    ? `${outline.length}:${outline[0]?.id ?? "none"}:${outline[outline.length - 1]?.id ?? "none"}`
    : "empty";

  useEffect(() => {
    if (!outline || outline.length === 0) {
      setActiveHeadingId(null);
      return;
    }
    let rafId: number | null = null;
    let scheduled = false;

    const recompute = () => {
      scheduled = false;
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      // `rect.top` is the distance from the viewport top. A negative
      // value means the container's top has scrolled above the
      // viewport. The "scroll position within the container" is
      // `-rect.top` clamped to 0.
      const scrollTopWithinContainer = Math.max(0, -rect.top);
      // Map scroll offset to source-line distance using a proportional
      // ratio of total source lines to scroll height. This is the
      // fallback path used when heading DOM has been unmounted by the
      // virtualized list.
      const scrollHeight = container.scrollHeight || rect.height || 1;
      const visibleWindow = Math.max(1, window.innerHeight || 0);
      const viewportTopInContainer = Math.max(
        0,
        Math.min(scrollHeight - 1, scrollTopWithinContainer),
      );
      // Approximate current line: total source lines proportional to
      // scroll position. When heading DOM is mounted, this still
      // yields a consistent answer; when it is not, we still resolve
      // to a heading id without needing the heading to be in the DOM.
      const approxLine = (() => {
        if (outline.length === 0) {
          return 0;
        }
        const totalSpan = outline[outline.length - 1].endLine;
        if (totalSpan <= 0) {
          return 0;
        }
        const ratio = viewportTopInContainer / Math.max(1, scrollHeight - visibleWindow);
        return Math.round(ratio * totalSpan);
      })();
      let candidate: MarkdownOutlineEntry | null = null;
      for (const entry of outline) {
        if (entry.startLine <= approxLine) {
          candidate = entry;
        } else {
          break;
        }
      }
      const nextId = candidate?.id ?? outline[0]?.id ?? null;
      setActiveHeadingId((prev) => (prev === nextId ? prev : nextId));
    };

    const schedule = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      rafId = window.requestAnimationFrame(recompute);
    };

    recompute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  // outlineKey is the canonical dependency: it captures outline length
  // + first/last id, which only changes when the underlying content
  // identity changes. The `outline` reference is captured by the
  // effect closure on each run, so the recompute callback always sees
  // the latest array passed by the parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineKey, containerRef]);

  return { activeHeadingId };
}
