/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLawhubToken,
  getLawhubToken,
  LawhubError,
  loginLawhub,
  publishScheme,
  schemeViewerUrl,
  setLawhubToken,
} from "./api";

const BASE = "https://hub.example.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("token storage", () => {
  it("round-trips and clears the lawhub token", () => {
    expect(getLawhubToken()).toBeNull();
    setLawhubToken("tok-1");
    expect(getLawhubToken()).toBe("tok-1");
    clearLawhubToken();
    expect(getLawhubToken()).toBeNull();
  });
});

describe("schemeViewerUrl", () => {
  it("builds the viewer url and normalizes trailing slashes", () => {
    expect(schemeViewerUrl(BASE, 7)).toBe(`${BASE}/schemes/7`);
    expect(schemeViewerUrl(`${BASE}/`, 7)).toBe(`${BASE}/schemes/7`);
  });
});

describe("loginLawhub", () => {
  it("POSTs username/password to /api/auth/login and returns token", async () => {
    const spy = vi.fn(async () =>
      jsonResponse({ token: "jwt-abc", user: { id: 1, username: "alice" } }),
    );
    vi.stubGlobal("fetch", spy);
    const resp = await loginLawhub(BASE, "alice", "pw");
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/auth/login`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      username: "alice",
      password: "pw",
    });
    expect(resp.token).toBe("jwt-abc");
  });

  it("throws LawhubError on 401 and stores no token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "invalid" }, 401)),
    );
    await expect(loginLawhub(BASE, "alice", "bad")).rejects.toBeInstanceOf(
      LawhubError,
    );
    expect(getLawhubToken()).toBeNull();
  });
});

describe("publishScheme", () => {
  it("POSTs {title,html} to /api/schemes with Bearer token", async () => {
    const spy = vi.fn(async () => jsonResponse({ id: 42, title: "方案" }, 201));
    vi.stubGlobal("fetch", spy);
    const resp = await publishScheme(BASE, "tok-1", {
      title: "方案",
      html: "<html></html>",
    });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/schemes`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-1",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({ title: "方案" });
    expect(resp.id).toBe(42);
  });

  it("throws without a token instead of sending an unauthenticated request", async () => {
    const spy = vi.fn(async () => jsonResponse({ id: 1 }, 201));
    vi.stubGlobal("fetch", spy);
    await expect(
      publishScheme(BASE, "", { title: "x", html: "<p/>" }),
    ).rejects.toBeInstanceOf(LawhubError);
    expect(spy).not.toHaveBeenCalled();
  });
});
