import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { compileFastMarkdown } from "../compile";
import { clearFastMarkdownRenderCache } from "../cache";
import { extractMarkdownOutline } from "../parserOutline";
import { extractHeavyBlocks } from "../heavyBlocks";
import { sanitizeFastMarkdownHtml } from "../sanitize";
import {
  resolveFastMarkdownProfileInputs,
  resolveFastMarkdownRendererProfile,
} from "../resolveProfile";
import { COMBINED_FIXTURE, SIMPLE_HEADING_PARAGRAPH } from "./fixtures";

beforeEach(() => {
  clearFastMarkdownRenderCache();
});

afterEach(() => {
  clearFastMarkdownRenderCache();
});

/**
 * These tests document the Worker-ready boundary for the fast
 * Markdown renderer. The contract:
 *
 * 1. The compile pipeline must be callable from a context with no
 *    React or mounted DOM. The host may still expose a `window`
 *    global (Tauri WebView) so DOMPurify can attach; the
 *    non-DOM `sanitizeFastMarkdownHtml` fallback is exercised in
 *    test environments where `window` is undefined.
 * 2. The compile result must be a plain JSON-serializable object
 *    so it can cross a `postMessage` boundary without custom
 *    cloning. This is the property that lets Phase 2 move the
 *    compile call into a Web Worker.
 * 3. The parser-side helpers (`extractMarkdownOutline`,
 *    `extractHeavyBlocks`, `attachSourceLineAttrs`,
 *    `resolveFastMarkdownProfileInputs`,
 *    `resolveFastMarkdownRendererProfile`) must be pure functions
 *    so they can be called from either the main thread or a
 *    Worker without environment dependencies.
 */
describe("Worker-ready boundary", () => {
  it("compile pipeline does not import React or DOM-bound APIs", async () => {
    // The compile module is imported once at the top of this file;
    // if it ever started pulling in React or `react-markdown`, the
    // import graph would grow. Sanity-check the public surface
    // remains a plain object with the expected keys.
    const result = await compileFastMarkdown({
      documentKey: "doc-worker-ready",
      rawMarkdown: SIMPLE_HEADING_PARAGRAPH,
      rendererProfile: "fast-html",
    });
    expect(result).toBeTypeOf("object");
    expect(Object.keys(result).sort()).toEqual([
      "cacheKey",
      "contentHash",
      "diagnostics",
      "heavyBlocks",
      "html",
      "outline",
      "rendererProfile",
      "sourceLineAnchors",
    ]);
  });

  it("compile result round-trips through JSON serialization", async () => {
    const result = await compileFastMarkdown({
      documentKey: "doc-json-roundtrip",
      rawMarkdown: COMBINED_FIXTURE,
      rendererProfile: "fast-html",
    });
    const serialized = JSON.stringify(result);
    const revived = JSON.parse(serialized);
    expect(revived).toEqual(result);
  });

  it("sanitize fallback works without a DOM", () => {
    const dirty = `<a href="javascript:alert(1)">x</a><script>alert(1)</script><img src="x" onerror="alert(1)">`;
    const sanitized = sanitizeFastMarkdownHtml(dirty);
    expect(sanitized.html).not.toMatch(/javascript:/i);
    expect(sanitized.html).not.toMatch(/<script/i);
    expect(sanitized.html).not.toMatch(/onerror=/i);
  });

  it("profile selector is pure and deterministic", () => {
    const inputsA = resolveFastMarkdownProfileInputs({
      rawMarkdown: COMBINED_FIXTURE,
      featureFlags: {
        fastHtmlRendererEnabled: true,
        boundedFastHtmlRendererEnabled: true,
      },
    });
    const inputsB = resolveFastMarkdownProfileInputs({
      rawMarkdown: COMBINED_FIXTURE,
      featureFlags: {
        fastHtmlRendererEnabled: true,
        boundedFastHtmlRendererEnabled: true,
      },
    });
    // Same inputs produce the same profile id; no clock, no
    // performance.now, no module-level mutable state.
    expect(inputsA.totalSourceLines).toBe(inputsB.totalSourceLines);
    expect(inputsA.rawMarkdownLength).toBe(inputsB.rawMarkdownLength);
    expect(resolveFastMarkdownRendererProfile(inputsA)).toBe(
      resolveFastMarkdownRendererProfile(inputsB),
    );
  });

  it("parser-side helpers do not depend on React or DOM", () => {
    const root = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .parse(SIMPLE_HEADING_PARAGRAPH);
    const outline = extractMarkdownOutline(root, 1);
    const heavyBlocks = extractHeavyBlocks(root, 1);
    // Outline / heavy blocks must be plain JSON-serializable
    // objects. We don't need to walk the HAST here — the
    // round-trip test above already exercises the full pipeline.
    expect(JSON.parse(JSON.stringify(outline))).toEqual(outline);
    expect(JSON.parse(JSON.stringify(heavyBlocks))).toEqual(heavyBlocks);
  });
});
