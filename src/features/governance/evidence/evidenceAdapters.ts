import { readGateArtifactEvidence } from "./gateArtifactEvidenceReader";
import { createGovernanceEvidence } from "./governanceEvidence";
import { readOpenSpecEvidence } from "./openspecEvidenceReader";
import type {
  ProjectGovernanceProfile,
  GovernanceEcosystem,
} from "./projectGovernanceProfile";
import { readScriptEvidence } from "./scriptEvidenceReader";
import { readTrellisEvidence } from "./trellisEvidenceReader";
import type { GovernanceEvidence, WorkspaceGovernanceSnapshot } from "./types";
import { readWorkflowEvidence } from "./workflowEvidenceReader";

export type EvidenceCollectionContext = {
  readonly snapshot: WorkspaceGovernanceSnapshot;
  readonly profile: ProjectGovernanceProfile;
};

export type EvidenceAdapter = {
  readonly id: string;
  appliesTo(profile: ProjectGovernanceProfile): boolean;
  collect(
    context: EvidenceCollectionContext,
  ): Promise<readonly GovernanceEvidence[]>;
};

function hasSystem(
  profile: ProjectGovernanceProfile,
  system: ProjectGovernanceProfile["governanceSystems"][number],
) {
  return profile.governanceSystems.includes(system);
}

function hasRunnableScripts(profile: ProjectGovernanceProfile) {
  return Object.keys(profile.scripts).length > 0;
}

function hasNonGenericEcosystem(profile: ProjectGovernanceProfile) {
  return profile.ecosystems.some((ecosystem) => ecosystem !== "generic");
}

function commandForEcosystem(
  ecosystem: GovernanceEcosystem,
  profile: ProjectGovernanceProfile,
): string | null {
  if (ecosystem === "python") {
    if (profile.files.includes("pyproject.toml"))
      return "pytest / ruff / mypy or pyright";
    return "pytest";
  }
  if (ecosystem === "rust")
    return "cargo test && cargo fmt --check && cargo clippy";
  if (ecosystem === "go") return "go test ./... && go vet ./...";
  if (ecosystem === "maven") return "mvn verify";
  if (ecosystem === "gradle") return "gradle check";
  return null;
}

function createEcosystemEvidence(
  profile: ProjectGovernanceProfile,
): GovernanceEvidence[] {
  return profile.ecosystems.flatMap((ecosystem) => {
    const command = commandForEcosystem(ecosystem, profile);
    if (!command) {
      return [];
    }
    return [
      createGovernanceEvidence({
        id: `ecosystem:${ecosystem}:verification`,
        source: "script",
        status: "pass",
        title: `${ecosystem} verification surface`,
        summary: `Detected ${ecosystem} project metadata; expected verification surface: ${command}.`,
        provenance: {
          sourceType: "adapter",
          sourceId: `ecosystem:${ecosystem}`,
          observedAt: "1970-01-01T00:00:00.000Z",
          adapterId: "ecosystem-verification-adapter@1",
          qualifier: command,
        },
      }),
    ];
  });
}

export const governanceEvidenceAdapters: readonly EvidenceAdapter[] = [
  {
    id: "governance-config-adapter@1",
    appliesTo: (profile) => profile.configEvidence.length > 0,
    collect: async ({ profile }) => profile.configEvidence,
  },
  {
    id: "openspec-adapter@1",
    appliesTo: (profile) => hasSystem(profile, "openspec"),
    collect: async ({ snapshot }) => readOpenSpecEvidence(snapshot),
  },
  {
    id: "trellis-adapter@1",
    appliesTo: (profile) => hasSystem(profile, "trellis"),
    collect: async ({ snapshot }) => readTrellisEvidence(snapshot),
  },
  {
    id: "package-script-adapter@1",
    appliesTo: hasRunnableScripts,
    collect: async ({ snapshot, profile }) =>
      readScriptEvidence(snapshot, profile),
  },
  {
    id: "workflow-adapter@1",
    appliesTo: (profile) => profile.workflows.length > 0,
    collect: async ({ snapshot, profile }) =>
      readWorkflowEvidence(snapshot, profile),
  },
  {
    id: "gate-artifact-adapter@1",
    appliesTo: (profile) => profile.gates.length > 0,
    collect: async ({ snapshot, profile }) =>
      readGateArtifactEvidence(snapshot, profile),
  },
  {
    id: "ecosystem-verification-adapter@1",
    appliesTo: hasNonGenericEcosystem,
    collect: async ({ profile }) => createEcosystemEvidence(profile),
  },
];

export function selectEvidenceAdapters(profile: ProjectGovernanceProfile) {
  return governanceEvidenceAdapters.filter((adapter) =>
    adapter.appliesTo(profile),
  );
}
