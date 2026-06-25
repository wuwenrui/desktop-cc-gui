export const CODEX_DISK_PROVIDER_PROFILE_ID = "__disk__";
export const CODEX_DISK_PROVIDER_PROFILE_NAME = "codex-tui/default-config";

export type CodexProviderProfileOption = {
  id: string;
  name: string;
  source: "disk" | "managed";
};

export type CodexProviderProfileSelection = {
  providerProfileId?: string | null;
  providerProfile?: CodexProviderProfileOption | null;
};
