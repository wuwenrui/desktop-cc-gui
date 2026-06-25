/**
 * Convert a Mermaid-rendered SVG string into a base64 `data:` URL that can
 * be used as an `<img src>` and consumed by viewerjs.
 *
 * Why base64 instead of `encodeURIComponent`:
 * - Mermaid v11 often inlines a `<style>` block whose CSS contains characters
 *   that confuse the `data:image/svg+xml;charset=utf-8,` form (e.g. embedded
 *   `<!--` sequences, `<` selectors).
 * - base64 is binary-safe and viewerjs can clone the resulting `<img>` without
 *   parsing the SVG DOM itself.
 *
 * Why TextEncoder + btoa:
 * - `btoa` only accepts latin-1 characters. Mermaid diagrams can contain
 *   non-ASCII labels (e.g. Chinese node names) that would throw inside
 *   `btoa` directly. Encoding to UTF-8 first via TextEncoder, then
 *   concatenating bytes into a binary string, is the standard safe path.
 */
export function svgToDataUrl(svg: string): string {
  if (!svg) {
    return "";
  }
  const utf8Bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i += 1) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
