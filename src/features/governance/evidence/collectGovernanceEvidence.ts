import { selectEvidenceAdapters } from "./evidenceAdapters";
import { deriveProjectGovernanceProfile } from "./projectGovernanceProfile";
import type { GovernanceEvidence, WorkspaceGovernanceSnapshot } from "./types";

export async function collectGovernanceEvidence(
  snapshot: WorkspaceGovernanceSnapshot,
): Promise<GovernanceEvidence[]> {
  const profile = await deriveProjectGovernanceProfile(snapshot);
  const adapters = selectEvidenceAdapters(profile);
  const adapterEvidence = await Promise.all(
    adapters.map((adapter) => adapter.collect({ snapshot, profile })),
  );

  return adapterEvidence
    .flat()
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
}
