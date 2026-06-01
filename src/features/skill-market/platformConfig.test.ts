/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SKILLHUB_BASE_URL,
  SKILLHUB_BASE_URL_KEY,
  getPlatformBaseUrl,
  setPlatformBaseUrl,
} from "./platformConfig";

describe("platformConfig", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns the dev default when nothing is stored", () => {
    expect(getPlatformBaseUrl()).toBe(DEFAULT_SKILLHUB_BASE_URL);
  });

  it("returns the stored base url", () => {
    window.localStorage.setItem(SKILLHUB_BASE_URL_KEY, "https://hub.example.com");
    expect(getPlatformBaseUrl()).toBe("https://hub.example.com");
  });

  it("normalizes trailing slashes and whitespace on read", () => {
    window.localStorage.setItem(SKILLHUB_BASE_URL_KEY, "  https://hub.example.com/// ");
    expect(getPlatformBaseUrl()).toBe("https://hub.example.com");
  });

  it("persists a normalized base url and returns it", () => {
    const result = setPlatformBaseUrl("  http://10.0.0.1:8000/ ");
    expect(result).toBe("http://10.0.0.1:8000");
    expect(getPlatformBaseUrl()).toBe("http://10.0.0.1:8000");
  });

  it("falls back to the default when given an empty value", () => {
    expect(setPlatformBaseUrl("   ")).toBe(DEFAULT_SKILLHUB_BASE_URL);
  });
});
