#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_CONFIG_PATH = "src-tauri/tauri.conf.json";
const UPDATE_BASE_URL_ENV = "LAWYER_COPILOT_UPDATE_BASE_URL";

export function normalizeUpdateBaseUrl(value) {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue) {
    throw new Error(`${UPDATE_BASE_URL_ENV} is required.`);
  }

  const parsed = new URL(rawValue);
  if (parsed.protocol !== "https:") {
    throw new Error(`${UPDATE_BASE_URL_ENV} must use HTTPS.`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${UPDATE_BASE_URL_ENV} must not include query or hash parts.`);
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${normalizedPath}`;
}

export function buildUpdaterEndpoint(baseUrl) {
  return `${normalizeUpdateBaseUrl(baseUrl)}/latest.json`;
}

export function buildArtifactUrl(baseUrl, fileName) {
  if (typeof fileName !== "string" || !fileName || fileName.includes("/")) {
    throw new Error("Artifact file name must be a single path segment.");
  }
  return `${normalizeUpdateBaseUrl(baseUrl)}/${encodeURIComponent(fileName)}`;
}

export function configureUpdaterConfig(config, baseUrl) {
  return {
    ...config,
    plugins: {
      ...(config.plugins ?? {}),
      updater: {
        ...(config.plugins?.updater ?? {}),
        endpoints: [buildUpdaterEndpoint(baseUrl)],
      },
    },
  };
}

function configureFile(configPath, baseUrl) {
  const current = JSON.parse(readFileSync(configPath, "utf8"));
  const next = configureUpdaterConfig(current, baseUrl);
  writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
}

function main() {
  configureFile(process.argv[2] ?? DEFAULT_CONFIG_PATH, process.env[UPDATE_BASE_URL_ENV]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
