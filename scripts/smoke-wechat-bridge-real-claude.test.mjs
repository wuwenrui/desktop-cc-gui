import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";

test("real Claude smoke helpers select an explicit workspace or a Claude workspace", async () => {
  const { realClaudeSmokeInternals } = await import("./smoke-wechat-bridge-real-claude.mjs");
  const workspaces = [
    {
      id: "codex-ws",
      name: "codex",
      path: "/tmp/codex",
      settings: { engineType: "codex" },
    },
    {
      id: "claude-ws",
      name: "icu",
      path: "/tmp/icu",
      settings: { engineType: "claude" },
    },
  ];

  assert.equal(realClaudeSmokeInternals.selectWorkspace(workspaces, "claude-ws").id, "claude-ws");
  assert.equal(realClaudeSmokeInternals.selectWorkspace(workspaces, null).id, "claude-ws");
});

test("real Claude smoke helpers build a minimal non-sensitive probe request", async () => {
  const { realClaudeSmokeInternals } = await import("./smoke-wechat-bridge-real-claude.mjs");
  const body = realClaudeSmokeInternals.buildProbeRequest("real-smoke-msg");

  assert.equal(body.model, "claude");
  assert.equal(body.user, "real-smoke-user");
  assert.deepEqual(body.messages, [
    { role: "user", content: "只回复 OK，不要解释。" },
  ]);
});

test("real Claude smoke helpers require an exact OK response", async () => {
  const { realClaudeSmokeInternals } = await import("./smoke-wechat-bridge-real-claude.mjs");

  assert.equal(realClaudeSmokeInternals.normalizeProbeContent("OK\n"), "OK");
  assert.throws(
    () => realClaudeSmokeInternals.assertProbeContent("电脑端暂时没有响应"),
    /expected exact OK/,
  );
});

test("real Claude smoke helpers wait for the daemon TCP port", async () => {
  const { realClaudeSmokeInternals } = await import("./smoke-wechat-bridge-real-claude.mjs");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await realClaudeSmokeInternals.waitForTcpPort(`127.0.0.1:${address.port}`, {
      attempts: 2,
      intervalMs: 1,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
