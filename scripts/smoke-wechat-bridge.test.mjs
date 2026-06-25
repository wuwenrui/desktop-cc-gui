import test from "node:test";
import assert from "node:assert/strict";

test("wechat bridge smoke helpers build isolated WeClaw config", async () => {
  const { smokeInternals } = await import("./smoke-wechat-bridge.mjs");

  const config = smokeInternals.buildWeclawConfig("http://127.0.0.1:18012/v1/chat/completions");

  assert.equal(config.default_agent, "lawyer-copilot");
  assert.equal(
    config.agents["lawyer-copilot"].endpoint,
    "http://127.0.0.1:18012/v1/chat/completions",
  );
  assert.deepEqual(config.agents["lawyer-copilot"].aliases, ["lc", "law"]);
});

test("wechat bridge smoke helpers detect scan-ready WeClaw output", async () => {
  const { smokeInternals } = await import("./smoke-wechat-bridge.mjs");

  assert.equal(smokeInternals.hasScanPrompt("QR URL: https://example.test/q"), true);
  assert.equal(smokeInternals.hasScanPrompt("Waiting for scan..."), true);
  assert.equal(smokeInternals.hasScanPrompt("plain startup log"), false);
});

test("wechat bridge smoke helpers isolate ports from a running local bridge", async () => {
  const { smokeInternals } = await import("./smoke-wechat-bridge.mjs");

  const config = smokeInternals.resolveSmokeConfig({
    WECHAT_SMOKE_DAEMON_ADDR: "127.0.0.1:47339",
    WECHAT_SMOKE_BRIDGE_ADDR: "127.0.0.1:18039",
    WECHAT_SMOKE_WECLAW_API_ADDR: "127.0.0.1:18038",
    WECHAT_SMOKE_TOKEN: "test-token",
  });

  assert.equal(config.daemonAddr, "127.0.0.1:47339");
  assert.equal(config.bridgeAddr, "127.0.0.1:18039");
  assert.equal(config.weclawApiAddr, "127.0.0.1:18038");
  assert.equal(config.bridgeBaseUrl, "http://127.0.0.1:18039");
  assert.equal(config.bridgeChatEndpoint, "http://127.0.0.1:18039/v1/chat/completions");
  assert.equal(config.token, "test-token");
});

test("wechat bridge smoke helpers require the isolated desktop fallback", async () => {
  const { smokeInternals } = await import("./smoke-wechat-bridge.mjs");

  assert.equal(
    smokeInternals.assertIsolatedFallbackContent(
      "  电脑端暂时没有响应，请确认桌面端正在运行后重试。\n",
    ),
    "电脑端暂时没有响应，请确认桌面端正在运行后重试。",
  );
  assert.throws(
    () => smokeInternals.assertIsolatedFallbackContent("我是 Claude，可以正常回复。"),
    /did not return the expected desktop fallback/,
  );
  assert.throws(
    () => smokeInternals.assertIsolatedFallbackContent(""),
    /did not return the expected desktop fallback/,
  );
});
