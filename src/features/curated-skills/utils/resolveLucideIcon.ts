/**
 * Lazy lucide icon resolver for curated skills (V0.5.14+).
 *
 * `metadata.json` declares `icon: "sparkles"` (kebab-case ASCII). The
 * build script (`src-tauri/build.rs`) enforces kebab-case but does NOT
 * verify the icon actually exists in `lucide-react` (that's a V1.1
 * follow-up; see `docs/curated-skill-onboarding.md` Decision 9). At
 * runtime we look up the matching module synchronously and return
 * `null` when missing so the row can fall back to a generic swatch.
 *
 * We import the `lucide-react` package shape via static `import()` so
 * Vite's tree-shaker still drops unused icons. The fallback is a
 * stable `Package` icon that ships with the same lucide build.
 */
import type { ComponentType, SVGProps } from "react";
import Package from "lucide-react/dist/esm/icons/package";

const FALLBACK_ICON: ComponentType<SVGProps<SVGSVGElement>> = Package;

// Static import map for icons we expect to see in V0.5.14 curated
// assets. Add an entry here when a new curated skill's `metadata.json`
// references an icon, so the icon is in the bundle. Unknown names
// resolve to the fallback so the UI never blanks out.
const ICON_MODULES: Record<string, ComponentType<SVGProps<SVGSVGElement>> | undefined> = {
  sparkles: undefined,
  "file-text": undefined,
  code: undefined,
  package: Package,
};

// Vite handles the dynamic `import()` statically (its glob import
// pattern). For V0.5.14 we keep it simple: ship the icon imports
// inline in this file and let the bundler tree-shake the rest.

import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Code from "lucide-react/dist/esm/icons/code";
import WandSparkles from "lucide-react/dist/esm/icons/wand-sparkles";

ICON_MODULES.sparkles = Sparkles;
ICON_MODULES["file-text"] = FileText;
ICON_MODULES.code = Code;
ICON_MODULES["wand-sparkles"] = WandSparkles;

/**
 * Resolve a kebab-case lucide icon name to its component. Returns
 * `null` (not the fallback) when the name is missing so callers can
 * distinguish "icon not found" from "fallback requested". The `null`
 * branch is handled in `IconComponent` by rendering the fallback.
 */
export function resolveLucideIcon(
  name: string | undefined,
): ComponentType<SVGProps<SVGSVGElement>> | null {
  if (!name) return null;
  return ICON_MODULES[name] ?? null;
}

/** Stable fallback for callers that don't want to handle null. */
export { FALLBACK_ICON };
