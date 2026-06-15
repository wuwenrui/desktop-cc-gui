import { beforeEach, describe, expect, it, vi } from "vitest";

let storedLanguage = "zh";
const writeClientStoreValueMock = vi.hoisted(() => vi.fn());

vi.mock("../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(() => storedLanguage),
  writeClientStoreValue: writeClientStoreValueMock,
}));

describe("i18n dynamic locale loading", () => {
  beforeEach(() => {
    vi.resetModules();
    storedLanguage = "zh";
    writeClientStoreValueMock.mockReset();
  });

  it("loads only the stored startup locale and loads another locale on switch", async () => {
    const module = await import("./index");
    const i18n = await module.i18nReady;

    expect(i18n.language).toBe("zh");
    expect(i18n.hasResourceBundle("zh", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("en", "translation")).toBe(false);

    await i18n.changeLanguage("en");

    expect(i18n.language).toBe("en");
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
  });

  it("preserves saveLanguage storage behavior", async () => {
    const { saveLanguage } = await import("./index");

    saveLanguage("en");

    expect(writeClientStoreValueMock).toHaveBeenCalledWith("app", "language", "en");
  });
});
