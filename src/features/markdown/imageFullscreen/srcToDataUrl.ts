/**
 * Resolve an image source URL to something viewerjs can load directly.
 *
 * Strategy:
 * - http(s) / data: / blob: / asset: URLs → pass through unchanged.
 *   Why: base64-encoding a 4MB PNG balloons memory by ~33% and viewerjs
 *   already loads `<img src={url}>` natively, so converting to dataURL
 *   is pure waste.
 * - file:// and local relative paths (workspace-internal) → resolve via
 *   `readLocalImageDataUrl` (Tauri bridge). If the bridge returns null
 *   or throws, fall back to the original src so the browser's native
 *   `file://` handling kicks in.
 * - missing workspaceId + file:// → skip the bridge, hand `file://` to
 *   the browser (Tauri webview handles it natively).
 *
 * No content-length preflight: the Tauri webview restricts `fetch` on
 * `file://` / `asset:` schemes, and adding a HEAD request would race
 * with the image load. We just hand the URL to viewerjs and let it
 * own the load lifecycle.
 */

export type ResolvedImageViewerSrc = {
  finalSrc: string;
  /** True iff the resolver actually ran the Tauri bridge. */
  converted: boolean;
};

const DATA_URL_PREFIX = /^data:image\/[a-z0-9.+-]+;/i;

function isValidDataUrl(value: string): boolean {
  return DATA_URL_PREFIX.test(value);
}

const HTTP_PREFIX = /^(https?:)/i;
const DATA_PREFIX = /^data:/i;
const BLOB_PREFIX = /^blob:/i;
const ASSET_PREFIX = /^asset:/i;
const FILE_PREFIX = /^file:\/\//i;

function isLikelyLocalRelative(src: string): boolean {
  if (!src) {
    return false;
  }
  // Absolute POSIX path: "/Users/foo.png"
  if (src.startsWith("/") && !src.startsWith("//")) {
    return true;
  }
  // Absolute Windows path: "C:\foo.png" or "C:/foo.png" or
  // UNC path "\\server\share".
  if (/^[A-Za-z]:[\\/]/.test(src)) {
    return true;
  }
  if (/^\\\\[^\\]/.test(src)) {
    return true;
  }
  // No scheme at all → treat as local relative (no http(s):/data:/
  // blob:/asset:/file: prefix).
  return !/^[a-z][a-z0-9+.-]*:/i.test(src);
}

export async function resolveImageViewerSrc(
  src: string,
  workspaceId: string | null | undefined,
  bridge?: (workspaceId: string, path: string) => Promise<string | null>,
): Promise<ResolvedImageViewerSrc> {
  if (!src) {
    return { finalSrc: "", converted: false };
  }
  if (HTTP_PREFIX.test(src) || DATA_PREFIX.test(src) || BLOB_PREFIX.test(src) ||
      ASSET_PREFIX.test(src)) {
    return { finalSrc: src, converted: false };
  }
  if (FILE_PREFIX.test(src) || isLikelyLocalRelative(src)) {
    if (!workspaceId || !workspaceId.trim()) {
      return { finalSrc: src, converted: false };
    }
    try {
      const dataUrl = bridge
        ? await bridge(workspaceId, src)
        : await defaultBridge(workspaceId, src);
      if (dataUrl && isValidDataUrl(dataUrl)) {
        return { finalSrc: dataUrl, converted: true };
      }
      // Bridge returned a falsy value or a non-image data URL (e.g. a
      // text payload or a malformed response). Fall through to the
      // original src so the browser can still try.
    } catch {
      // Bridge failures (network, missing workspace, etc.) fall through.
    }
    return { finalSrc: src, converted: false };
  }
  // Unknown scheme — best effort, hand it to viewerjs.
  return { finalSrc: src, converted: false };
}

async function defaultBridge(workspaceId: string, path: string): Promise<string | null> {
  const { readLocalImageDataUrl } = await import("../../../services/tauri");
  return readLocalImageDataUrl(workspaceId, path);
}
