/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClaudeProviders,
  getCodexProviders,
  updateClaudeProvider,
  updateCodexProvider,
} from "../../services/tauri/vendors";
import { SKILLHUB_BASE_URL_KEY } from "../skill-market/platformConfig";
import {
  LAWHUB_DOMAIN,
  LEGACY_LAWHUB_HOST,
  LEGACY_NEWAPI_HOST,
  migrateEndpointText,
  migrateEnv,
  migrateLegacyEndpoints,
  NEWAPI_DOMAIN,
} from "./legacyEndpointMigration";

vi.mock("../../services/tauri/vendors", () => ({
  getClaudeProviders: vi.fn(),
  getCodexProviders: vi.fn(),
  updateClaudeProvider: vi.fn(),
  updateCodexProvider: vi.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getClaudeProviders).mockResolvedValue([]);
  vi.mocked(getCodexProviders).mockResolvedValue([]);
});

afterEach(() => {
  window.localStorage.clear();
});

describe("migrateEndpointText", () => {
  it("should map the :3000 host to the model domain and the bare host to lawhub", () => {
    expect(migrateEndpointText(LEGACY_NEWAPI_HOST)).toBe(NEWAPI_DOMAIN);
    expect(migrateEndpointText(LEGACY_LAWHUB_HOST)).toBe(LAWHUB_DOMAIN);
  });

  it("should replace hosts embedded in longer text (toml/url with path)", () => {
    const toml = `base_url = "${LEGACY_NEWAPI_HOST}/v1"\nother = "${LEGACY_LAWHUB_HOST}/api"`;
    expect(migrateEndpointText(toml)).toBe(
      `base_url = "${NEWAPI_DOMAIN}/v1"\nother = "${LAWHUB_DOMAIN}/api"`,
    );
  });

  it("should be idempotent and leave unrelated text untouched", () => {
    const once = migrateEndpointText(LEGACY_NEWAPI_HOST);
    expect(migrateEndpointText(once)).toBe(once);
    expect(migrateEndpointText("https://api.anthropic.com")).toBe(
      "https://api.anthropic.com",
    );
  });
});

describe("migrateEnv", () => {
  it("should migrate string values and report changed", () => {
    const { changed, next } = migrateEnv({
      ANTHROPIC_BASE_URL: LEGACY_NEWAPI_HOST,
      ANTHROPIC_AUTH_TOKEN: "sk-keep",
      SOME_FLAG: true,
    });
    expect(changed).toBe(true);
    expect(next.ANTHROPIC_BASE_URL).toBe(NEWAPI_DOMAIN);
    expect(next.ANTHROPIC_AUTH_TOKEN).toBe("sk-keep");
    expect(next.SOME_FLAG).toBe(true);
  });

  it("should return the same reference when nothing changes", () => {
    const env = { ANTHROPIC_BASE_URL: NEWAPI_DOMAIN };
    const { changed, next } = migrateEnv(env);
    expect(changed).toBe(false);
    expect(next).toBe(env);
  });
});

describe("migrateLegacyEndpoints", () => {
  it("should drop the legacy skillhub base url so the new default applies", async () => {
    window.localStorage.setItem(SKILLHUB_BASE_URL_KEY, LEGACY_LAWHUB_HOST);
    await migrateLegacyEndpoints();
    expect(window.localStorage.getItem(SKILLHUB_BASE_URL_KEY)).toBeNull();
  });

  it("should keep a user-customized skillhub base url", async () => {
    window.localStorage.setItem(SKILLHUB_BASE_URL_KEY, "https://my.own.host");
    await migrateLegacyEndpoints();
    expect(window.localStorage.getItem(SKILLHUB_BASE_URL_KEY)).toBe(
      "https://my.own.host",
    );
  });

  it("should rewrite claude provider env pointing at the legacy host", async () => {
    vi.mocked(getClaudeProviders).mockResolvedValue([
      {
        id: "new-api",
        name: "New API",
        settingsConfig: {
          env: {
            ANTHROPIC_BASE_URL: LEGACY_NEWAPI_HOST,
            ANTHROPIC_AUTH_TOKEN: "sk-x",
          },
        },
      },
      {
        id: "official",
        name: "Anthropic",
        settingsConfig: { env: { ANTHROPIC_BASE_URL: "https://api.anthropic.com" } },
      },
    ]);

    await migrateLegacyEndpoints();

    expect(updateClaudeProvider).toHaveBeenCalledTimes(1);
    const [id, updates] = vi.mocked(updateClaudeProvider).mock.calls[0];
    expect(id).toBe("new-api");
    expect((updates as { id: string }).id).toBe("new-api");
    expect(
      (updates as { settingsConfig: { env: Record<string, string> } })
        .settingsConfig.env.ANTHROPIC_BASE_URL,
    ).toBe(NEWAPI_DOMAIN);
  });

  it("should rewrite codex provider configToml containing the legacy host", async () => {
    vi.mocked(getCodexProviders).mockResolvedValue([
      {
        id: "codex-newapi",
        name: "New API",
        configToml: `[model_providers.newapi]\nbase_url = "${LEGACY_NEWAPI_HOST}/v1"`,
      },
      { id: "codex-clean", name: "Clean", configToml: "model = \"gpt-5\"" },
    ]);

    await migrateLegacyEndpoints();

    expect(updateCodexProvider).toHaveBeenCalledTimes(1);
    const [id, updates] = vi.mocked(updateCodexProvider).mock.calls[0];
    expect(id).toBe("codex-newapi");
    expect((updates as { configToml: string }).configToml).toContain(
      `${NEWAPI_DOMAIN}/v1`,
    );
  });

  it("should not block when provider commands fail", async () => {
    vi.mocked(getClaudeProviders).mockRejectedValue(new Error("no tauri"));
    vi.mocked(getCodexProviders).mockRejectedValue(new Error("no tauri"));
    await expect(migrateLegacyEndpoints()).resolves.toBeUndefined();
  });
});
