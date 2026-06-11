export const CODEX_DISK_PROVIDER_PROFILE_ID = "__disk__";
export const CODEX_DISK_PROVIDER_PROFILE_NAME = "磁盘 .codex 配置";

export type CodexProviderProfileOption = {
  id: string;
  name: string;
  source: "disk" | "managed";
};

export type CodexProviderProfileSelection = {
  providerProfileId?: string | null;
  providerProfile?: CodexProviderProfileOption | null;
};
