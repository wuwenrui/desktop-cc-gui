import type { FastMarkdownRenderResult } from "./types";

const MAX_FAST_MARKDOWN_CACHE_ENTRIES = 24;

const fastCompileCache = new Map<string, FastMarkdownRenderResult>();

function readFastCompileCacheEntry(cacheKey: string) {
  const cached = fastCompileCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  fastCompileCache.delete(cacheKey);
  fastCompileCache.set(cacheKey, cached);
  return cached;
}

function writeFastCompileCacheEntry(cacheKey: string, result: FastMarkdownRenderResult) {
  fastCompileCache.delete(cacheKey);
  fastCompileCache.set(cacheKey, result);
  while (fastCompileCache.size > MAX_FAST_MARKDOWN_CACHE_ENTRIES) {
    const oldestKey = fastCompileCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    fastCompileCache.delete(oldestKey);
  }
}

export function getCachedFastMarkdownRender(cacheKey: string) {
  return readFastCompileCacheEntry(cacheKey);
}

export function setCachedFastMarkdownRender(cacheKey: string, result: FastMarkdownRenderResult) {
  writeFastCompileCacheEntry(cacheKey, result);
}

export function clearFastMarkdownRenderCache() {
  fastCompileCache.clear();
}

export function getFastMarkdownRenderCacheSize(): number {
  return fastCompileCache.size;
}
