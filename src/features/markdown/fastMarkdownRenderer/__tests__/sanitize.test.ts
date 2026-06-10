import { describe, expect, it } from "vitest";
import { isSafeHref, sanitizeFastMarkdownHtml } from "../sanitize";

describe("sanitizeFastMarkdownHtml", () => {
  it("returns an empty result for empty input", () => {
    const result = sanitizeFastMarkdownHtml("");
    expect(result.html).toBe("");
    expect(result.rejectedEventHandlers).toBe(0);
    expect(result.rejectedUnsafeUrls).toBe(0);
    expect(result.rejectedForbiddenTags).toBe(0);
    expect(result.sanitizedSuccessfully).toBe(true);
  });

  it("strips inline event handler attributes", () => {
    const html = '<span onclick="alert(1)">hover me</span>';
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html.toLowerCase()).not.toContain("onclick");
    expect(result.rejectedEventHandlers).toBeGreaterThanOrEqual(1);
    expect(result.sanitizedSuccessfully).toBe(true);
  });

  it("strips onerror attributes on anchors", () => {
    const html = '<a href="https://example.com" onerror="alert(1)">safe</a>';
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html.toLowerCase()).not.toContain("onerror");
    expect(result.rejectedEventHandlers).toBeGreaterThanOrEqual(1);
  });

  it("strips javascript: URL schemes from href", () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html.toLowerCase()).not.toMatch(/javascript:/);
    expect(result.rejectedUnsafeUrls).toBeGreaterThanOrEqual(1);
  });

  it("strips data: URL schemes used for XSS", () => {
    const html = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html.toLowerCase()).not.toContain("data:text/html");
  });

  it("removes forbidden tags such as script and style", () => {
    const html = '<script>alert(1)</script><p>safe paragraph</p>';
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html.toLowerCase()).not.toContain("<script");
    expect(result.rejectedForbiddenTags).toBeGreaterThanOrEqual(1);
    expect(result.html).toContain("safe paragraph");
  });

  it("preserves allowlisted tags like strong, em, code, pre", () => {
    const html = "<p>text with <strong>bold</strong> and <em>em</em></p>";
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html).toContain("<strong>bold</strong>");
    expect(result.html).toContain("<em>em</em>");
  });

  it("preserves safe https links", () => {
    const html = '<a href="https://example.com">safe</a>';
    const result = sanitizeFastMarkdownHtml(html);
    expect(result.html).toContain("https://example.com");
    expect(result.html).toContain("safe");
  });
});

describe("isSafeHref", () => {
  it("rejects empty href", () => {
    expect(isSafeHref("")).toBe(false);
  });

  it("accepts fragment-only links", () => {
    expect(isSafeHref("#section")).toBe(true);
  });

  it("accepts http(s) and mailto schemes", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com/path")).toBe(true);
    expect(isSafeHref("mailto:foo@bar.com")).toBe(true);
  });

  it("rejects javascript: schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
  });
});
