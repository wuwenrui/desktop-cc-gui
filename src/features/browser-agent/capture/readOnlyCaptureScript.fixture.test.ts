// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_AGENT_READ_ONLY_CAPTURE_SCRIPT } from "../utils/readOnlyCaptureScript";

type CaptureResult = {
  pageType: string;
  primaryContent?: { text: string; source: string; truncated: boolean };
  readableBlocks: Array<{ role: string; text: string }>;
  visualEvidence: Array<{ kind: string; label: string; altText?: string | null }>;
  forms: Array<{ label: string; fields: unknown[]; submitTargets: unknown[] }>;
  headings: Array<{ text: string }>;
  noiseDiagnostics: Array<{ kind: string; message: string }>;
  omittedCapabilities?: string[];
};

function renderFixture(html: string, path = "/issues/123") {
  document.body.innerHTML = html;
  window.history.replaceState(null, "", path);
}

function runCapture(): CaptureResult {
  return eval(BROWSER_AGENT_READ_ONLY_CAPTURE_SCRIPT) as CaptureResult;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent ?? "";
    },
  });
  Element.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 320,
    height: 32,
    top: 0,
    right: 320,
    bottom: 32,
    left: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("canonical Browser Agent read-only capture script", () => {
  it("extracts GitHub issue-like primary content and headings", () => {
    renderFixture(`
      <main>
        <h1 class="gh-header-title">Browser Dock stale badge is wrong</h1>
        <div class="js-comment-body markdown-body">
          <p>The issue body says the branch menu disappears after reload.</p>
        </div>
      </main>
    `);

    const result = runCapture();

    expect(result.pageType).toBe("issue");
    expect(result.primaryContent?.text).toContain("branch menu disappears");
    expect(result.headings[0]?.text).toContain("Browser Dock stale badge");
  });

  it("extracts docs/article text, forms, and visual evidence", () => {
    renderFixture(`
      <article class="markdown-body">
        <h1>Setup guide</h1>
        <p>Install the local development server before opening Browser Dock.</p>
        <figure><img src="/assets/flow.png" alt="Browser flow diagram" /></figure>
        <form aria-label="Profile form">
          <label>Email <input name="email" value="user@example.com" /></label>
          <button type="submit">Save profile</button>
        </form>
      </article>
    `, "/docs/setup");

    const result = runCapture();

    expect(result.pageType).toBe("article");
    expect(result.primaryContent?.text).toContain("Install the local development server");
    expect(result.visualEvidence[0]).toMatchObject({ altText: "Browser flow diagram" });
    expect(result.forms[0]?.label).toContain("Profile form");
    expect(result.forms[0]?.submitTargets.length).toBe(1);
  });

  it("reports complex page limitations instead of overclaiming support", () => {
    renderFixture(`
      <main>
        <h1>Metrics dashboard</h1>
        <canvas></canvas>
        <iframe src="https://example.com/embed"></iframe>
        <div data-virtual-list="true">Only rendered row</div>
      </main>
    `, "/dashboard");

    const result = runCapture();

    expect(result.pageType).toBe("dashboard");
    expect(result.omittedCapabilities).toEqual(expect.arrayContaining([
      "canvas",
      "iframe",
      "virtual_list",
    ]));
  });
});
