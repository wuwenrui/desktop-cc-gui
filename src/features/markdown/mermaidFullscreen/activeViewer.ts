import type Viewer from "viewerjs";

/**
 * Module-level singleton: at most one Mermaid fullscreen viewer is alive
 * at any time. When a new viewer is about to be created, the previous one
 * MUST be destroyed first to avoid overlapping backdrops and leaked
 * DOM nodes (the desktop shell renders Mermaid blocks in two independent
 * surfaces — messages and file preview — and a user can open both).
 */
let activeViewer: Viewer | null = null;

export function getActiveViewer(): Viewer | null {
  return activeViewer;
}

export function setActiveViewer(next: Viewer | null): void {
  activeViewer = next;
}

export function destroyActiveViewer(): void {
  if (activeViewer) {
    try {
      activeViewer.destroy();
    } catch {
      // viewer.destroy can throw if the underlying DOM is gone; ignore.
    }
    activeViewer = null;
  }
}
