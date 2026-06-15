export type MediaOwnerEntry = {
  url: string;
  ownerId: string;
  byteSize: number | null;
  createdAtMs: number;
};

const activeObjectUrls = new Map<string, MediaOwnerEntry>();
let revokedCount = 0;

export function createOwnedObjectUrl(
  blob: Blob,
  options: {
    ownerId: string;
    byteSize?: number | null;
  },
) {
  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(url, {
    url,
    ownerId: options.ownerId,
    byteSize: options.byteSize ?? blob.size ?? null,
    createdAtMs: Date.now(),
  });
  return url;
}

export function revokeOwnedObjectUrl(url: string | null | undefined) {
  if (!url || !activeObjectUrls.has(url)) {
    return false;
  }
  URL.revokeObjectURL(url);
  activeObjectUrls.delete(url);
  revokedCount += 1;
  return true;
}

export function getMediaOwnerDiagnostics() {
  const entries = Array.from(activeObjectUrls.values());
  const knownRetainedBytes = entries.reduce((total, entry) => {
    if (entry.byteSize == null || !Number.isFinite(entry.byteSize)) {
      return total;
    }
    return total + entry.byteSize;
  }, 0);
  return {
    activeCount: entries.length,
    revokedCount,
    retainedBytes: entries.some((entry) => entry.byteSize == null) ? null : knownRetainedBytes,
    unsupportedReason: entries.some((entry) => entry.byteSize == null)
      ? "Some media owners do not expose byte size."
      : null,
    evidenceClass: "proxy" as const,
  };
}

export function resetMediaOwnerRegistryForTests() {
  activeObjectUrls.clear();
  revokedCount = 0;
}
