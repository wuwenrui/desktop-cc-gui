import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

function fail(message) {
  console.error(`[agent-domain-event-adoption] ${message}`);
  process.exitCode = 1;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function requireToken(source, relativePath, token) {
  if (!source.includes(token)) {
    fail(`${relativePath} missing token "${token}"`);
  }
}

const producerPath = "src/features/threads/hooks/useThreadEventHandlers.ts";
const consumerPath = "src/features/threads/domain-events/domainEventGovernanceConsumer.ts";
const integrationPath = "src/features/threads/hooks/useThreads.ts";
const packagePath = "package.json";

for (const relativePath of [producerPath, consumerPath, integrationPath]) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) {
    fail(`missing required file: ${relativePath}`);
  }
}

const producerSource = readText(producerPath);
for (const token of [
  "domainEventController?: DomainEventRuntimeController | null",
  "domainEventController.emitInternal",
  "domainEventFactories.turnCompleted",
  "domainEventFactories.turnFailed",
]) {
  requireToken(producerSource, producerPath, token);
}
if (producerSource.includes("messageDeltaAppended(")) {
  fail("first adoption path must not use high-frequency message delta events");
}

const consumerSource = readText(consumerPath);
for (const token of [
  "createDomainEventGovernanceConsumer",
  "runtime.subscribe",
  "turn.completed",
  "turn.failed",
  "terminalTurnEvents",
]) {
  requireToken(consumerSource, consumerPath, token);
}
for (const forbidden of [
  "localStorage",
  "indexedDB",
  "fetch(",
  "WebSocket",
  "postMessage",
  "@tauri-apps/api",
  "document.",
  "window.",
]) {
  if (consumerSource.includes(forbidden)) {
    fail(`governance consumer must not use persistence, transport, or dashboard token "${forbidden}"`);
  }
}

const integrationSource = readText(integrationPath);
for (const token of [
  "createDomainEventRuntimeController",
  "createDomainEventGovernanceConsumer",
  "domainEventController: domainEventRuntimeController",
]) {
  requireToken(integrationSource, integrationPath, token);
}

const packageJson = JSON.parse(readText(packagePath));
if (
  packageJson.scripts?.["check:agent-domain-event-adoption"] !==
  "node scripts/check-agent-domain-event-adoption.mjs"
) {
  fail("package.json must expose check:agent-domain-event-adoption through a Node entrypoint");
}

if (process.exitCode) {
  process.exit();
}

console.log("[agent-domain-event-adoption] ok");
