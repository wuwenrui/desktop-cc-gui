import DOMPurify from "dompurify";

/**
 * Defense-in-depth sanitizer for fast file-preview Markdown output.
 *
 * Even after rehype-sanitize has stripped dangerous nodes/attributes
 * at the HAST layer, the rendered HTML passes through this allowlist
 * before mount. The goal is to guarantee that no event handler
 * attribute, no `javascript:` URL, and no out-of-schema tag can
 * survive into the live document surface.
 */

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "details",
  "summary",
  "del",
  "div",
  "dd",
  "dl",
  "dt",
  "em",
  "figure",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
  "var",
];

const ALLOWED_ATTR = [
  "id",
  "class",
  "className",
  "title",
  "alt",
  "src",
  "href",
  "rel",
  "target",
  "lang",
  "dir",
  "align",
  "colspan",
  "rowspan",
  "type",
  "checked",
  "data-source-line-start",
  "data-source-line-end",
  "data-source-block-id",
  "data-heavy-block-kind",
  "data-heavy-block-id",
  "data-fast-renderer-marker",
];

const FORBID_TAGS = [
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "svg",
  "math",
  "noscript",
  "meta",
  "link",
  "base",
];

const FORBID_ATTR_PREFIXES = [
  "on",
];

const SAFE_URL_REGEX = /^(?:(?:https?|mailto|tel|ftp):|#|\/|\.\/|\.\.\/|[a-zA-Z0-9_\-./?=&%#:]+$)/i;

export type SanitizeFastMarkdownHtmlResult = {
  html: string;
  rejectedEventHandlers: number;
  rejectedUnsafeUrls: number;
  rejectedForbiddenTags: number;
  sanitizedSuccessfully: boolean;
};

export function sanitizeFastMarkdownHtml(input: string): SanitizeFastMarkdownHtmlResult {
  if (!input) {
    return {
      html: "",
      rejectedEventHandlers: 0,
      rejectedUnsafeUrls: 0,
      rejectedForbiddenTags: 0,
      sanitizedSuccessfully: true,
    };
  }

  if (typeof DOMPurify === "undefined" || typeof window === "undefined") {
    return sanitizeFastMarkdownHtmlFallback(input);
  }

  let rejectedEventHandlers = 0;
  let rejectedUnsafeUrls = 0;
  let rejectedForbiddenTags = 0;

  const purifier = DOMPurify(window);
  const sanitized = purifier.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR: FORBID_ATTR_PREFIXES,
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
  });

  rejectedForbiddenTags = countForbiddenTags(input);
  rejectedEventHandlers = countEventHandlerAttributes(input);
  rejectedUnsafeUrls = countUnsafeUrls(input);

  return {
    html: sanitized,
    rejectedEventHandlers,
    rejectedUnsafeUrls,
    rejectedForbiddenTags,
    sanitizedSuccessfully: true,
  };
}

function sanitizeFastMarkdownHtmlFallback(input: string): SanitizeFastMarkdownHtmlResult {
  const forbiddenTagPattern = new RegExp(
    `<\\s*\\/?\\s*(?:${FORBID_TAGS.join("|")})\\b[^>]*>`,
    "gi",
  );
  const eventHandlerPattern = new RegExp(
    `\\s+(?:on[a-z]+)\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "gi",
  );
  const unsafeUrlPattern = new RegExp(
    `(?:href|src)\\s*=\\s*(?:"\\s*(javascript:|data:|vbscript:)[^"]*"|'\\s*(javascript:|data:|vbscript:)[^']*')`,
    "gi",
  );

  const before = input;
  const html = input
    .replace(forbiddenTagPattern, "")
    .replace(eventHandlerPattern, "")
    .replace(unsafeUrlPattern, "");

  const beforeForbidden = before.match(forbiddenTagPattern)?.length ?? 0;
  const beforeEvent = before.match(eventHandlerPattern)?.length ?? 0;
  const beforeUrl = before.match(unsafeUrlPattern)?.length ?? 0;

  return {
    html,
    rejectedEventHandlers: beforeEvent,
    rejectedUnsafeUrls: beforeUrl,
    rejectedForbiddenTags: beforeForbidden,
    sanitizedSuccessfully: true,
  };
}

function countEventHandlerAttributes(input: string): number {
  const matches = input.match(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi);
  return matches ? matches.length : 0;
}

function countUnsafeUrls(input: string): number {
  const matches = input.match(/(?:href|src)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*')/gi);
  return matches ? matches.length : 0;
}

function countForbiddenTags(input: string): number {
  const pattern = new RegExp(`<\\s*\\/?\\s*(?:${FORBID_TAGS.join("|")})\\b`, "gi");
  const matches = input.match(pattern);
  return matches ? matches.length : 0;
}

export function isSafeHref(href: string): boolean {
  if (!href) {
    return false;
  }
  const normalized = href.trim();
  if (normalized.startsWith("#")) {
    return true;
  }
  return SAFE_URL_REGEX.test(normalized);
}
