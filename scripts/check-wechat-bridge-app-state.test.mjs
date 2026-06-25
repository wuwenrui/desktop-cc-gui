import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("app state checker detects scan-ready WeClaw output without exposing QR text", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(appStateCheckInternals.hasScanSignal("QR URL: https://example.test/login"), true);
  assert.equal(appStateCheckInternals.hasScanSignal("Waiting for scan..."), true);
  assert.equal(appStateCheckInternals.hasScanSignal("ordinary log line"), false);
});

test("app state checker ignores scan prompts after WeClaw reports expiration", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.hasScanSignal(
      "QR URL: https://example.test/login\nWaiting for scan...\nQR code expired.\nlogin failed: QR code expired\n",
    ),
    false,
  );
});

test("app state checker summarizes stopped and running states", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.deepEqual(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
    }),
    {
      ok: true,
      bridgeHealth: "ok",
      bridgeProcess: "running",
      weclawProcess: "running",
      scan: "ready",
      boundWechat: "missing",
      realWechatReply: "waiting",
      realWechatMedia: "waiting",
      realWechatQuote: "waiting",
    },
  );
  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: false,
      bridgePidRunning: false,
      weclawPidRunning: false,
      scanSignal: false,
    }).ok,
    false,
  );
  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: false,
      scanSignal: true,
    }).scan,
    "not-ready",
  );
});

test("app state checker reports bound WeChat account when no QR scan is needed", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  const summary = appStateCheckInternals.buildSummary({
    bridgeHealthOk: true,
    bridgePidRunning: true,
    weclawPidRunning: true,
    scanSignal: false,
    boundWechatAccount: true,
  });

  assert.equal(summary.ok, true);
  assert.equal(summary.scan, "bound");
  assert.equal(summary.boundWechat, "present");
});

test("app state checker detects bound WeClaw credentials without exposing wxid", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");
  const root = await mkdtemp(join(tmpdir(), "lc-wechat-accounts-"));

  try {
    await writeFile(join(root, "ignored.sync.json"), JSON.stringify({ ilink_user_id: "wxid_sync" }));
    await writeFile(join(root, "empty.json"), JSON.stringify({ ilink_user_id: " " }));
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "active.json"), JSON.stringify({ ilink_user_id: "wxid_real_secret" }));

    const bound = appStateCheckInternals.readBoundWechatAccount(root);

    assert.equal(bound, true);
    assert.equal(JSON.stringify(bound).includes("wxid_real_secret"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("app state checker treats zombie process stats as stopped", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(appStateCheckInternals.processStatIsRunning("Z"), false);
  assert.equal(appStateCheckInternals.processStatIsRunning("Z+"), false);
  assert.equal(appStateCheckInternals.processStatIsRunning("S"), true);
});

test("app state checker reads audit from the bridge data directory", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.auditLogPath("/tmp/app/wechat-bridge"),
    "/tmp/app/wechat-bridge/data/audit.log",
  );
});

test("app state checker requires a real replied WeChat audit entry when requested", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.realWechatReplyState(
      "ts=1 wxid=local-app-smoke method=engine_send_message_sync workspace=icu decision=allow body_hash=abc\n",
    ),
    "waiting",
  );
  assert.equal(
    appStateCheckInternals.realWechatReplyState(
      "ts=2 wxid=wxid_real method=engine_send_message_sync workspace=icu decision=error body_hash=def\n",
    ),
    "seen-without-reply",
  );
  assert.equal(
    appStateCheckInternals.realWechatReplyState(
      "ts=3 wxid=wxid_real method=engine_send_message_sync workspace=icu decision=allow body_hash=ghi\n",
    ),
    "replied",
  );

  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatReplyState: "waiting",
      requireRealActivity: true,
    }).ok,
    false,
  );
});

test("app state checker does not treat local probes as real WeChat replies", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  const syntheticAudit =
    "ts=1 wxid=local-wechat method=engine_send_message_sync workspace=icu decision=allow body_hash=abc\n" +
    "ts=2 wxid=local-rich-final method=engine_send_message_sync workspace=icu decision=allow body_hash=def\n" +
    "ts=3 wxid=wxid_probe_final method=engine_send_message_sync workspace=icu decision=allow body_hash=ghi\n" +
    "ts=4 wxid=codex-live-dir-probe-1782252234632 method=engine_send_message_sync workspace=icu decision=allow body_hash=jkl\n" +
    "ts=5 wxid=real-smoke-user method=engine_send_message_sync workspace=icu decision=allow body_hash=mno\n" +
    "ts=6 wxid=smoke-user method=engine_send_message_sync workspace=icu decision=allow body_hash=pqr\n" +
    "ts=7 wxid=wxid_final_real_image_probe method=engine_send_message_sync workspace=icu decision=allow body_hash=stu\n";

  assert.equal(appStateCheckInternals.realWechatReplyState(syntheticAudit), "waiting");
});

test("app state checker explains waiting real WeChat state without message body", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  const audit =
    "ts=1 wxid=local-wechat method=engine_send_message_sync workspace=icu decision=allow body=secret-one\n" +
    "ts=2 wxid=codex-live-dir-probe-1782252234632 method=engine_send_message_sync workspace=icu decision=allow body=secret-two\n";
  const weclaw =
    "2026/06/24 05:22:14 Image save directory: /tmp/media\n" +
    "2026/06/24 05:22:14 Starting message bridge for 1 account(s)...\n" +
    "2026/06/24 05:22:14 [handler] default agent ready: lawyer-copilot\n";

  assert.deepEqual(
    appStateCheckInternals.buildDiagnosticHints({
      auditText: audit,
      auditPath: "/tmp/app/wechat-bridge/data/audit.log",
      weclawLog: weclaw,
      weclawLogPath: "/tmp/app/wechat-bridge/weclaw.log",
    }),
    {
      lastAuditWxidKind: "synthetic",
      lastAuditDecision: "allow",
      lastWeclawHandler: "none",
      lastWeclawDiagnostic: "none",
      auditPath: "/tmp/app/wechat-bridge/data/audit.log",
      weclawLogPath: "/tmp/app/wechat-bridge/weclaw.log",
    },
  );
  assert.equal(
    JSON.stringify(
      appStateCheckInternals.buildDiagnosticHints({
        auditText: audit,
        auditPath: "/tmp/app/wechat-bridge/data/audit.log",
        weclawLog: weclaw,
        weclawLogPath: "/tmp/app/wechat-bridge/weclaw.log",
      }),
    ).includes("secret"),
    false,
  );
});

test("app state checker summarizes real WeChat media from WeClaw logs", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.realWechatMediaState(
      "2026/06/24 01:15:01 [handler] received image from wxid-a@im.wechat, saving to /tmp/media\n" +
        "2026/06/24 01:15:02 [handler] saved image to /tmp/media/a.jpg (2048 bytes)\n",
    ),
    "saved",
  );
  assert.equal(
    appStateCheckInternals.realWechatMediaState(
      "2026/06/24 01:16:02 [handler] failed to save image from wxid-b@im.wechat: image has no URL\n",
    ),
    "failed",
  );
  assert.equal(
    appStateCheckInternals.realWechatMediaState(
      "2026/06/24 01:16:02 [handler] failed to prepare inbound image from wxid-b@im.wechat: image has no URL\n",
    ),
    "failed",
  );
  assert.equal(
    appStateCheckInternals.realWechatMediaState(
      "2026/06/24 01:17:03 [handler] received non-text message from wxid-c@im.wechat, skipping\n",
    ),
    "skipped",
  );
  assert.equal(
    appStateCheckInternals.realWechatMediaState(
      "2026/06/24 01:18:03 [handler] unsupported non-text message from wxid-c@im.wechat: items=[type=2 keys=mysteryImagePayload,type]\n",
    ),
    "unsupported",
  );

  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatMediaState: "saved",
    }).realWechatMedia,
    "saved",
  );
});

test("app state checker can require real WeChat media", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatReplyState: "replied",
      realWechatMediaState: "waiting",
      requireRealActivity: true,
      requireRealMedia: true,
    }).ok,
    false,
  );

  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatReplyState: "replied",
      realWechatMediaState: "saved",
      requireRealActivity: true,
      requireRealMedia: true,
    }).ok,
    true,
  );
});

test("app state checker can require real quoted WeChat context", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.realWechatQuoteState(
      "2026/06/24 01:15:02 [handler] received quoted message from wxid-real@im.wechat\n",
    ),
    "parsed",
  );
  assert.equal(
    appStateCheckInternals.realWechatQuoteState(
      "2026/06/24 01:15:02 [handler] unparsed quote candidate from wxid-real@im.wechat: item[0].quotePayload keys=unknownText\n",
    ),
    "unparsed",
  );
  assert.equal(
    appStateCheckInternals.realWechatQuoteState(
      "2026/06/24 00:10:00 [handler] received quoted message from wxid-old@im.wechat\n" +
        "2026/06/24 01:14:00 Image save directory: /tmp/media\n" +
        "2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n",
    ),
    "waiting",
  );

  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatReplyState: "replied",
      realWechatMediaState: "saved",
      realWechatQuoteState: "waiting",
      requireRealActivity: true,
      requireRealMedia: true,
      requireRealQuote: true,
    }).ok,
    false,
  );
  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatReplyState: "replied",
      realWechatMediaState: "saved",
      realWechatQuoteState: "unparsed",
      requireRealActivity: true,
      requireRealMedia: true,
      requireRealQuote: true,
    }).ok,
    false,
  );

  assert.equal(
    appStateCheckInternals.buildSummary({
      bridgeHealthOk: true,
      bridgePidRunning: true,
      weclawPidRunning: true,
      scanSignal: true,
      realWechatReplyState: "replied",
      realWechatMediaState: "saved",
      realWechatQuoteState: "parsed",
      requireRealActivity: true,
      requireRealMedia: true,
      requireRealQuote: true,
    }).ok,
    true,
  );
});

test("app state checker surfaces WeClaw quote diagnostics without raw content", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");
  const weclaw =
    "2026/06/24 01:14:00 Image save directory: /tmp/media\n" +
    "2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n" +
    "2026/06/24 01:15:02 [handler] unparsed quote candidate from wxid-real@im.wechat: item[0].quotePayload keys=unknownText\n" +
    "2026/06/24 01:15:03 [handler] message shape from wxid-real@im.wechat: item[0] keys=mysteryContext,textItem,type\n";

  assert.equal(appStateCheckInternals.lastWeclawHandlerKind(weclaw), "message-shape");
  assert.equal(
    appStateCheckInternals.lastWeclawHandlerKind(
      weclaw +
        "2026/06/24 01:15:04 [handler] unparsed quote candidate from wxid-real@im.wechat: item[0].quotePayload keys=unknownText\n",
    ),
    "quote-unparsed",
  );
  assert.equal(appStateCheckInternals.lastWeclawDiagnostic(weclaw), "item[0] keys=mysteryContext,textItem,type");
  assert.equal(
    appStateCheckInternals.lastWeclawDiagnostic(
      weclaw +
        "2026/06/24 01:15:04 [handler] unparsed quote candidate from wxid-real@im.wechat: item[0].quotePayload keys=unknownText\n",
    ),
    "item[0].quotePayload keys=unknownText",
  );
  assert.equal(JSON.stringify(appStateCheckInternals.buildDiagnosticHints({
    auditText: "",
    auditPath: "/tmp/audit.log",
    weclawLog: weclaw,
    weclawLogPath: "/tmp/weclaw.log",
  })).includes("unknownText"), false);
});

test("app state checker ignores media from previous WeClaw runs", async () => {
  const { appStateCheckInternals } = await import("./check-wechat-bridge-app-state.mjs");

  assert.equal(
    appStateCheckInternals.realWechatMediaState(
      "2026/06/24 00:10:00 [handler] received non-text message from wxid-old@im.wechat, skipping\n" +
        "2026/06/24 01:14:00 Image save directory: /tmp/media\n" +
        "2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n",
    ),
    "waiting",
  );
});
