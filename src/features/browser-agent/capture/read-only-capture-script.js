(() => {
  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const textOf = (node) => {
    const text = node && node.innerText ? String(node.innerText) : "";
    return normalizeText(text);
  };
  const visible = (element) => {
    try {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style && style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    } catch (_) {
      return false;
    }
  };
  const bounds = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const numericStyle = (element, property) => {
    try {
      const value = window.getComputedStyle(element).getPropertyValue(property);
      return Number.parseFloat(value) || 0;
    } catch (_) {
      return 0;
    }
  };
  const uniqueByText = (items, textSelector) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = normalizeText(textSelector(item)).toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };
  const headingFor = (element, index, fallbackLevel) => ({
    targetId: "heading-" + index,
    role: "heading",
    level: fallbackLevel,
    text: textOf(element).slice(0, 240),
    truncated: textOf(element).length > 240
  });
  const collectHeadings = () => {
    const semanticHeadings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
      .filter(visible)
      .map((element) => ({
        element,
        level: Number(element.tagName.slice(1)) || 2,
        score: 1000 - bounds(element).y
      }));
    if (semanticHeadings.length > 0) {
      return uniqueByText(semanticHeadings, (item) => textOf(item.element))
        .slice(0, 80)
        .map((item, index) => headingFor(item.element, index, item.level));
    }
    const visualHeadings = Array.from(document.body ? document.body.querySelectorAll("body *") : [])
      .slice(0, 900)
      .filter(visible)
      .map((element) => {
        const text = textOf(element);
        const rect = bounds(element);
        const fontSize = numericStyle(element, "font-size");
        const fontWeight = numericStyle(element, "font-weight");
        const childText = Array.from(element.children || []).map(textOf).join(" ");
        const isMostlyOwnText = !childText || normalizeText(childText) !== text;
        return { element, text, rect, fontSize, fontWeight, isMostlyOwnText };
      })
      .filter((candidate) => {
        if (candidate.text.length < 8 || candidate.text.length > 180) {
          return false;
        }
        if (candidate.rect.width < 80 || candidate.rect.height < 12) {
          return false;
        }
        if (!candidate.isMostlyOwnText && candidate.text.length > 80) {
          return false;
        }
        return candidate.fontSize >= 20 || candidate.fontWeight >= 600;
      })
      .map((candidate) => ({
        element: candidate.element,
        level: candidate.fontSize >= 26 ? 1 : 2,
        score: candidate.fontSize * 12 + candidate.fontWeight / 10 - Math.max(candidate.rect.y, 0) / 50
      }));
    return uniqueByText(semanticHeadings.concat(visualHeadings), (item) => textOf(item.element))
      .sort((left, right) => right.score - left.score)
      .slice(0, 80)
      .map((item, index) => headingFor(item.element, index, item.level));
  };
  const safeInput = (input, index) => {
    const type = String(input.getAttribute("type") || "text").toLowerCase();
    const identity = String(input.name || input.id || input.placeholder || input.getAttribute("aria-label") || "");
    const sensitive = type === "password" || type === "hidden" || /token|secret|authorization|password|cookie|api[_-]?key/i.test(identity);
    return {
      targetId: "input-" + index,
      kind: type === "checkbox" || type === "radio" ? type : "input",
      label: input.labels && input.labels[0] ? textOf(input.labels[0]) : (input.getAttribute("aria-label") || input.name || input.id || ""),
      accessibleName: input.getAttribute("aria-label"),
      text: null,
      href: null,
      placeholder: input.placeholder || null,
      valuePreview: sensitive ? null : String(input.value || "").slice(0, 120),
      disabled: Boolean(input.disabled),
      visible: visible(input),
      sensitive,
      bounds: bounds(input)
    };
  };
  const safeTarget = (element, index, kind) => ({
    targetId: kind + "-" + index,
    kind,
    label: textOf(element) || element.getAttribute("aria-label") || element.value || element.href || "",
    accessibleName: element.getAttribute("aria-label"),
    text: textOf(element),
    href: element.href || null,
    placeholder: null,
    valuePreview: null,
    disabled: Boolean(element.disabled),
    visible: true,
    sensitive: false,
    bounds: bounds(element)
  });
  const regionFor = (element, index) => ({
    regionId: "region-" + index,
    role: String(element.getAttribute("role") || element.tagName || "region").toLowerCase(),
    label: element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || "",
    textPreview: textOf(element).slice(0, 1200),
    truncated: textOf(element).length > 1200
  });
  const contentRegionSelector = [
    "main",
    "article",
    "[role='main']",
    "[role='article']",
    ".article",
    ".article-content",
    ".articleContent",
    ".article_body",
    ".articleBody",
    ".content",
    ".contentText",
    ".detail",
    ".detail-content",
    ".main-content",
    ".markdown",
    ".markdown-body",
    ".news-content",
    ".post-content",
    ".rich-text",
    "#article",
    "#content",
    "#main"
  ].join(",");
  const contentRegions = uniqueByText(
    Array.from(document.querySelectorAll(contentRegionSelector))
      .filter(visible)
      .filter((element) => textOf(element).length >= 80),
    textOf
  ).slice(0, 8);
  const isNoisyContainer = (element) => {
    const noisyTags = new Set(["NAV", "HEADER", "FOOTER", "ASIDE"]);
    const noisyRoles = new Set(["navigation", "banner", "contentinfo", "complementary", "menu", "menubar", "toolbar", "search"]);
    if (noisyTags.has(element.tagName)) {
      return true;
    }
    const role = String(element.getAttribute("role") || "").toLowerCase();
    if (noisyRoles.has(role)) {
      return true;
    }
    return Boolean(element.closest("nav,header,footer,aside,[role='navigation'],[role='banner'],[role='contentinfo'],[role='complementary'],[role='menu'],[role='menubar'],[role='toolbar']"));
  };
  const scoreMainContent = (element) => {
    const text = textOf(element);
    if (text.length < 120 || isNoisyContainer(element)) {
      return null;
    }
    const tag = element.tagName;
    const role = String(element.getAttribute("role") || "").toLowerCase();
    const className = String(element.className || "");
    const semanticBonus = tag === "ARTICLE" || role === "article" ? 520 : tag === "MAIN" || role === "main" ? 260 : 0;
    const contentClassBonus = /article|content|detail|markdown|post|entry|body|description/i.test(className) ? 760 : 0;
    const paragraphCount = element.querySelectorAll("p,li,pre,blockquote").length;
    const controlCount = element.querySelectorAll("button,input,select,textarea").length;
    const linkTextLength = Array.from(element.querySelectorAll("a")).map(textOf).join(" ").length;
    const linkRatio = text.length > 0 ? linkTextLength / text.length : 0;
    const pageTitle = normalizeText(document.title).split(/[·|\-—]/)[0] || "";
    const titleBonus = pageTitle && text.includes(pageTitle) ? 320 : 0;
    const rect = bounds(element);
    const viewportPenalty = rect.y > window.innerHeight * 1.5 ? 260 : 0;
    const navigationPenalty = linkRatio > 0.45 ? 1800 : linkRatio > 0.28 ? 1050 : linkRatio > 0.2 ? 520 : 0;
    const controlPenalty = controlCount > 8 ? controlCount * 42 : controlCount * 18;
    const oversizedPenalty = text.length > 6000 ? 700 : text.length > 3500 ? 320 : 0;
    const densityBonus = Math.min(paragraphCount, 24) * 75;
    return {
      element,
      text,
      score: Math.min(text.length, 1600) + semanticBonus + contentClassBonus + densityBonus + titleBonus - navigationPenalty - controlPenalty - viewportPenalty - oversizedPenalty
    };
  };
  const scoreTextBlock = (element) => {
    const text = textOf(element);
    if (text.length < 80 || isNoisyContainer(element)) {
      return null;
    }
    const className = String(element.className || "");
    const rect = bounds(element);
    const hasContentClass = /comment|markdown|body|description|content|article|detail|post|entry/i.test(className);
    const linkTextLength = Array.from(element.querySelectorAll("a")).map(textOf).join(" ").length;
    const linkRatio = text.length > 0 ? linkTextLength / text.length : 0;
    const imageCount = element.querySelectorAll("img,video,picture").length;
    const textNodeDensity = text.length / Math.max(rect.height, 1);
    const titlePrefixPenalty = /^skip to content|^navigation menu|^sign in\b/i.test(text) ? 1200 : 0;
    const actionNoisePenalty = /sign up for free|already have an account|sign in to comment/i.test(text) ? 520 : 0;
    const linkPenalty = linkRatio > 0.35 ? 900 : linkRatio > 0.2 ? 360 : 0;
    return {
      element,
      text,
      score:
        Math.min(text.length, 1200) +
        (hasContentClass ? 820 : 0) +
        imageCount * 120 +
        Math.min(textNodeDensity, 40) * 8 -
        linkPenalty -
        titlePrefixPenalty -
        actionNoisePenalty
    };
  };
  const readableBlockRole = (element) => {
    const className = String(element.className || "");
    const tag = element.tagName;
    if (/issue|comment|discussion/i.test(className)) return "issue_body";
    if (element.closest(".js-issue-title, .gh-header-title, .js-comment-body, .timeline-comment, [data-testid*='issue']")) return "issue_body";
    if (/markdown|doc|documentation/i.test(className)) return "docs_section";
    if (tag === "ARTICLE") return "article";
    if (tag === "FORM") return "form";
    if (/card|panel|widget|metric|dashboard/i.test(className)) return "dashboard_panel";
    if (tag === "PRE" || tag === "CODE") return "code";
    if (tag === "P" || tag === "LI" || tag === "BLOCKQUOTE") return "paragraph";
    return "other";
  };
  const collectReadableBlocks = (root) => {
    const blockSelectors = [
      "article",
      "[role='article']",
      ".markdown-body",
      ".markdown",
      ".js-comment-body",
      ".comment-body",
      ".comment",
      ".timeline-comment",
      ".discussion",
      ".issue-body",
      ".description",
      ".body",
      ".content",
      ".article-content",
      ".detail-content",
      "p",
      "li",
      "blockquote",
      "pre"
    ].join(",");
    const blocks = uniqueByText(
      Array.from(root.querySelectorAll(blockSelectors)).filter(visible),
      textOf
    )
      .map(scoreTextBlock)
      .filter(Boolean)
      .filter((candidate) => candidate.score > 120)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
    return blocks.map((block, index) => ({
      blockId: "readable-" + index,
      role: readableBlockRole(block.element),
      text: block.text.slice(0, 1200),
      score: Math.round(block.score),
      truncated: block.text.length > 1200
    }));
  };
  const selectMainVisibleText = () => {
    const scopedCandidates = contentRegions.concat(
      Array.from(document.body ? document.body.querySelectorAll("main,article,[role='main'],[role='article'],section,div") : [])
        .slice(0, 1400)
        .filter(visible)
    );
    const scored = uniqueByText(scopedCandidates, textOf)
      .map(scoreMainContent)
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);
    const best = scored[0];
    if (best && best.score > 260) {
      const blocks = collectReadableBlocks(best.element);
      return {
        text: blocks.length > 0 ? blocks.map((block) => block.text).join(" ") : best.text,
        source: best.element.tagName === "ARTICLE" ? "article" : "semantic_main",
        score: Math.round(best.score),
        element: best.element,
        blocks
      };
    }
    return {
      text: textOf(document.body),
      source: document.body ? "body_fallback" : "empty",
      score: 0,
      element: document.body,
      blocks: document.body ? collectReadableBlocks(document.body) : []
    };
  };
  const inferPageType = () => {
    const bodyText = textOf(document.body).toLowerCase();
    const path = location.pathname.toLowerCase();
    const hasIssueSignals = /\/issues\/\d+/.test(path) || document.querySelector("[data-testid*='issue'], .js-issue-title, .gh-header-title");
    if (hasIssueSignals) return "issue";
    if (document.querySelector("article, [role='article']")) return "article";
    if (document.querySelector("form input, form textarea, form select")) return "form";
    if (document.querySelector("[class*='dashboard'], [class*='chart'], [class*='metric'], canvas, svg")) return "dashboard";
    if (/docs|documentation|guide|reference|api/.test(path) || document.querySelector(".markdown, .markdown-body, [class*='docs']")) return "docs";
    if (bodyText.length < 220 && document.querySelector("#root, #app")) return "spa";
    return "unknown";
  };
  const collectNoiseDiagnostics = (primary) => {
    const diagnostics = [];
    const bodyText = textOf(document.body);
    const navTextLength = Array.from(document.querySelectorAll("nav,header,footer,aside,[role='navigation']")).map(textOf).join(" ").length;
    const linkTextLength = Array.from(document.querySelectorAll("a")).map(textOf).join(" ").length;
    const controlCount = document.querySelectorAll("button,input,select,textarea").length;
    if (bodyText.length > 0 && navTextLength / bodyText.length > 0.25) {
      diagnostics.push({ diagnosticId: "noise-navigation", kind: "navigation_noise", severity: "warning", message: "Navigation/header/footer text is a significant part of the page.", score: Math.round(navTextLength / bodyText.length * 100) });
    }
    if (bodyText.length > 0 && linkTextLength / bodyText.length > 0.35) {
      diagnostics.push({ diagnosticId: "noise-link-density", kind: "link_dense_region", severity: "warning", message: "The visible page is link-dense; summary may contain navigation noise.", score: Math.round(linkTextLength / bodyText.length * 100) });
    }
    if (controlCount > 20) {
      diagnostics.push({ diagnosticId: "noise-control-density", kind: "control_dense_region", severity: "info", message: "The page has many controls; it may be a dashboard or form.", score: controlCount });
    }
    if (/sign in|log in|create account|authenticat/i.test(bodyText) && primary.text.length < 800) {
      diagnostics.push({ diagnosticId: "noise-auth-wall", kind: "auth_wall", severity: "warning", message: "The page may be gated by sign-in or account creation content.", score: 1 });
    }
    if (primary.text.length < 160 && document.querySelector("#root, #app")) {
      diagnostics.push({ diagnosticId: "noise-spa-shell", kind: "spa_shell", severity: "warning", message: "The page looks like a sparse SPA shell; readable content may not be loaded yet.", score: primary.text.length });
    }
    return diagnostics.slice(0, 8);
  };
  const collectVisualEvidence = () => Array.from(document.querySelectorAll("figure,img,picture,video,a[href$='.png'],a[href$='.jpg'],a[href$='.jpeg'],a[href$='.gif'],a[href$='.webp'],a[href$='.pdf'],a[href*='user-attachments'],a[href*='assets'],a[href*='uploads']"))
    .filter(visible)
    .slice(0, 16)
    .map((element, index) => {
      const img = element.tagName === "IMG" ? element : element.querySelector("img");
      const src = img ? img.currentSrc || img.src || "" : element.href || "";
      let srcOrigin = null;
      try { srcOrigin = src ? new URL(src, location.href).origin : null; } catch (_) { srcOrigin = null; }
      const label = textOf(element) || (img && img.alt) || element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("download") || "visual evidence";
      const markdownContext = element.closest(".markdown-body,.js-comment-body,.comment-body,article,main,section,li,div");
      return {
        evidenceId: "visual-" + index,
        kind: element.tagName === "VIDEO" ? "video" : element.tagName === "A" ? "attachment" : element.tagName === "FIGURE" ? "figure" : "image",
        label: String(label).slice(0, 180),
        altText: img && img.alt ? String(img.alt).slice(0, 240) : null,
        srcOrigin,
        nearbyText: textOf(markdownContext || element).slice(0, 520),
        visible: true,
        sensitive: /token|secret|password|authorization|cookie/i.test(src + " " + label)
      };
    });
  const collectOmittedCapabilities = () => {
    const omitted = [];
    if (document.querySelector("iframe")) omitted.push("iframe");
    if (document.querySelector("canvas")) omitted.push("canvas");
    if (document.querySelector("[data-virtual-list], [data-virtualized], .virtual-list, .ReactVirtualized__Grid")) omitted.push("virtual_list");
    if (Array.from(document.querySelectorAll("*")).some((element) => Boolean(element.shadowRoot))) omitted.push("shadow_dom");
    return omitted;
  };
  const selectedMainContent = selectMainVisibleText();
  const mainVisibleText = selectedMainContent.text;
  const readableBlocks = selectedMainContent.blocks;
  return {
    title: document.title || null,
    url: location.href,
    selectedText: String(window.getSelection ? window.getSelection() : "").slice(0, 1000),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    visibleText: mainVisibleText.slice(0, 12000),
    pageType: inferPageType(),
    primaryContent: {
      text: mainVisibleText.slice(0, 12000),
      source: selectedMainContent.source,
      score: selectedMainContent.score,
      truncated: mainVisibleText.length > 12000
    },
    readableBlocks,
    noiseDiagnostics: collectNoiseDiagnostics(selectedMainContent),
    visualEvidence: collectVisualEvidence(),
    omittedCapabilities: collectOmittedCapabilities(),
    headings: collectHeadings(),
    links: Array.from(document.querySelectorAll("a[href]")).filter(visible).slice(0, 80).map((element, index) => safeTarget(element, index, "link")),
    buttons: Array.from(document.querySelectorAll("button,[role='button'],input[type='button'],input[type='submit']")).filter(visible).slice(0, 80).map((element, index) => safeTarget(element, index, "button")),
    forms: Array.from(document.querySelectorAll("form")).filter(visible).slice(0, 20).map((form, index) => ({
      formId: "form-" + index,
      label: form.getAttribute("aria-label") || textOf(form).slice(0, 160),
      method: form.method || null,
      actionOrigin: form.action ? new URL(form.action, location.href).origin : null,
      fields: Array.from(form.querySelectorAll("input,textarea,select")).slice(0, 40).map(safeInput),
      submitTargets: Array.from(form.querySelectorAll("button[type='submit'],input[type='submit']")).slice(0, 10).map((element, submitIndex) => safeTarget(element, submitIndex, "submit")),
      sensitive: false
    })),
    contentRegions: contentRegions.map(regionFor),
    languageHint: document.documentElement.lang || null
  };
})()
