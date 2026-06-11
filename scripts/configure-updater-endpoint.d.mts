export function normalizeUpdateBaseUrl(value: string | undefined): string;
export function buildUpdaterEndpoint(baseUrl: string): string;
export function buildArtifactUrl(baseUrl: string, fileName: string): string;
export function configureUpdaterConfig<T extends Record<string, unknown>>(
  config: T,
  baseUrl: string,
): T;
