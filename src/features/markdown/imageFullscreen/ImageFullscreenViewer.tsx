import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type Viewer from "viewerjs";
import { isThemeMutationAttribute } from "../../theme/utils/themeAppearance";
import { loadImageFullscreenStyles } from "../../../styles/featureStyleLoaders";
import {
  destroyActiveViewer,
  getActiveViewer,
  setActiveViewer,
} from "../mermaidFullscreen/activeViewer";
import { preloadViewerjs } from "../mermaidFullscreen/preloadViewerjs";
import { resolveImageViewerSrc } from "./srcToDataUrl";

type ImageFullscreenViewerProps = {
  open: boolean;
  src: string;
  alt?: string;
  workspaceId?: string | null;
  onClose: () => void;
};

const PANEL_LOCK_SELECTOR = ".panel-lock-overlay";

/**
 * Mirror of MermaidFullscreenViewer for inline images.
 *
 * Reuses the same viewerjs infrastructure (shared `preloadViewerjs`,
 * shared `activeViewer` singleton, shared CSS variable namespace) so
 * - the image viewer and the mermaid viewer cannot coexist (opening
 *   one tears down the other)
 * - the toolbar / close button / backdrop theme follows the document
 *   theme in lockstep with the mermaid viewer
 * - panel-lock tears down the viewer just like mermaid
 *
 * Differences vs MermaidFullscreenViewer:
 * - Toolbar enables `prev` / `next` (multi-image navigation)
 * - Source is a URL (possibly a `file://` or Tauri-bridge data URL)
 *   resolved via `resolveImageViewerSrc`, not a base64 SVG string
 */
export default function ImageFullscreenViewer({
  open,
  src,
  alt,
  workspaceId,
  onClose,
}: ImageFullscreenViewerProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const onCloseRef = useRef(onClose);
  const srcRef = useRef(src);
  const altRef = useRef(alt);
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    srcRef.current = src;
  }, [src]);
  useEffect(() => {
    altRef.current = alt;
  }, [alt]);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    if (!open || !src) {
      return;
    }

    let cancelled = false;
    let viewer: Viewer | null = null;
    let themeObserver: MutationObserver | null = null;
    let lockObserver: MutationObserver | null = null;

    (async () => {
      // Load viewerjs styles BEFORE constructing the viewer so the
      // backdrop and toolbar layout are correct on the first paint.
      // The styles are module-level cached, so this is a no-op on
      // subsequent opens.
      await loadImageFullscreenStyles();
      if (cancelled) {
        return;
      }
      const { default: ViewerCtor } = await preloadViewerjs();
      if (cancelled || !imgRef.current) {
        return;
      }
      // Singleton guarantee: close any previous viewer first so the
      // mermaid viewer (or another image viewer) cannot overlap.
      destroyActiveViewer();

      const resolved = await resolveImageViewerSrc(srcRef.current, workspaceIdRef.current);
      if (cancelled || !imgRef.current) {
        return;
      }
      if (!resolved.finalSrc) {
        // Bridge failure AND original src was empty/unusable: do not
        // construct a viewer with a bogus src (it would render a
        // broken-image icon and lock the user out of the surface).
        if (!cancelled) {
          console.warn(
            "[ImageFullscreenViewer] could not resolve src; closing",
            { originalSrc: srcRef.current },
          );
          onCloseRef.current();
        }
        return;
      }
      if (imgRef.current) {
        imgRef.current.src = resolved.finalSrc;
        if (altRef.current) {
          imgRef.current.alt = altRef.current;
        }
      }

      const reducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      try {
        viewer = new ViewerCtor(imgRef.current, {
          container: document.body,
          inline: false,
          navbar: true,
          title: false,
          transition: !reducedMotion,
          backdrop: true,
          toolbar: {
            zoomIn: true,
            zoomOut: true,
            oneToOne: true,
            reset: true,
            rotateLeft: true,
            rotateRight: true,
            flipHorizontal: true,
            flipVertical: true,
            prev: true,
            next: true,
            play: false,
          },
          shown() {
            if (cancelled) return;
            setActiveViewer(viewer);
          },
          hidden() {
            if (cancelled) return;
            onCloseRef.current();
          },
        });
      } catch (error) {
        // viewerjs constructor failures must not crash the React tree.
        console.error("[ImageFullscreenViewer] viewer construction failed", error);
        if (!cancelled) {
          onCloseRef.current();
        }
        return;
      }

      if (cancelled) {
        try {
          viewer.destroy();
        } catch {
          /* ignore */
        }
        return;
      }

      // viewerjs modal mode does not auto-show: open it explicitly.
      viewer.show();

      themeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (isThemeMutationAttribute(mutation.attributeName)) {
            try {
              viewer?.update();
            } catch {
              /* ignore */
            }
            break;
          }
        }
      });
      themeObserver.observe(document.documentElement, { attributes: true });

      lockObserver = new MutationObserver(() => {
        if (document.querySelector(PANEL_LOCK_SELECTOR)) {
          try {
            viewer?.destroy();
          } catch {
            /* ignore */
          }
          onCloseRef.current();
        }
      });
      lockObserver.observe(document.body, { childList: true, subtree: true });
    })();

    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      lockObserver?.disconnect();
      if (viewer) {
        try {
          viewer.destroy();
        } catch {
          /* ignore */
        }
      }
      if (getActiveViewer() === viewer) {
        setActiveViewer(null);
      }
    };
  }, [open, src]);

  if (!open || !src || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <img
      ref={imgRef}
      className="viewer-image"
      src=""
      alt={alt ?? ""}
      aria-hidden="true"
      data-testid="image-fullscreen-img"
    />,
    document.body,
  );
}
