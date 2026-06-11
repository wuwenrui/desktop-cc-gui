import type { ThreadSummary } from "../../../types";
import { CODEX_DISK_PROVIDER_PROFILE_ID } from "../../threads/constants/codexProviderProfiles";

export function resolveCodexProviderLabel(thread: ThreadSummary) {
  if ((thread.engineSource ?? "codex") !== "codex") {
    return null;
  }

  const profileId = thread.providerProfileId?.trim() ?? "";
  const label =
    thread.providerProfileName?.trim() ||
    thread.sourceLabel?.trim() ||
    (profileId && profileId !== CODEX_DISK_PROVIDER_PROFILE_ID ? profileId : "");

  return label || null;
}
