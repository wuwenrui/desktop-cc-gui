import type {
  ProjectMapDataset,
  ProjectMapLens,
  ProjectMapNode,
  ProjectMapRelation,
  ProjectMapSource,
} from "../types";

export const PROJECT_MAP_FIXTURE_NOW = "2026-06-03T00:00:00.000Z";

const DEFAULT_GENERATED_BY = {
  engine: "codex",
  model: "gpt-test",
  runId: "fixture-run",
};

export function createProjectMapSourceFixture(
  overrides: Partial<ProjectMapSource> = {},
): ProjectMapSource {
  return {
    type: "file",
    label: "README.md",
    path: "README.md",
    ...overrides,
  };
}

export function createProjectMapLensFixture(
  overrides: Partial<ProjectMapLens> = {},
): ProjectMapLens {
  const id = overrides.id ?? "overview";
  return {
    id,
    title: "Overview",
    shortTitle: "Overview",
    description: "Fixture overview lens.",
    status: "detected",
    confidence: "high",
    evidence: [],
    ...overrides,
  };
}

export function createProjectMapNodeFixture(
  overrides: Partial<ProjectMapNode> = {},
): ProjectMapNode {
  const id = overrides.id ?? "project-core";
  const title = overrides.title ?? "Project Core";
  const summary = overrides.summary ?? `${title} summary`;
  const base: ProjectMapNode = {
    id,
    lensId: "overview",
    nodeKind: "module",
    title,
    summary,
    detail: {
      coreDescription: summary,
      keyFacts: [],
      keyLogic: [],
      riskSignals: [],
      relatedArtifacts: [],
    },
    children: [],
    sources: [createProjectMapSourceFixture()],
    confidence: "high",
    stale: false,
    candidate: false,
    lastGeneratedAt: PROJECT_MAP_FIXTURE_NOW,
    generatedBy: DEFAULT_GENERATED_BY,
  };

  return {
    ...base,
    ...overrides,
    detail: overrides.detail ?? base.detail,
    children: overrides.children ?? base.children,
    sources: overrides.sources ?? base.sources,
    generatedBy: overrides.generatedBy ?? base.generatedBy,
  };
}

export function createProjectMapRelationFixture(
  overrides: Partial<ProjectMapRelation> = {},
): ProjectMapRelation {
  const id = overrides.id ?? "relation-api-data";
  return {
    id,
    sourceNodeId: "api-controller",
    targetNodeId: "data-store",
    type: "depends_on",
    direction: "forward",
    confidence: "high",
    sourceKind: "deterministic",
    evidence: [
      {
        id: `evidence-${id}`,
        source: createProjectMapSourceFixture({
          label: "API callsite",
          path: "src/api/controller.ts",
          line: 12,
        }),
        priority: "code",
        observedHash: null,
        observedAt: PROJECT_MAP_FIXTURE_NOW,
      },
    ],
    ...overrides,
  };
}

export function createProjectMapDatasetFixture(
  overrides: Partial<ProjectMapDataset> = {},
): ProjectMapDataset {
  const defaultNodes = [
    createProjectMapNodeFixture({
      id: "project-core",
      title: "Project Core",
      nodeKind: "concept",
      children: ["api-controller", "data-store"],
      sources: [
        createProjectMapSourceFixture({
          label: "README.md",
          path: "README.md",
        }),
      ],
    }),
    createProjectMapNodeFixture({
      id: "api-controller",
      title: "API Controller",
      summary: "REST controller surface.",
      parentId: "project-core",
      sources: [
        createProjectMapSourceFixture({
          label: "controller.ts",
          path: "src/api/controller.ts",
        }),
      ],
    }),
    createProjectMapNodeFixture({
      id: "data-store",
      title: "Data Store",
      summary: "Persistence boundary.",
      parentId: "project-core",
      sources: [
        createProjectMapSourceFixture({
          label: "store.ts",
          path: "src/db/store.ts",
        }),
      ],
    }),
  ];

  const base: ProjectMapDataset = {
    manifest: {
      schemaVersion: 2,
      projectName: "project-map-fixture",
      workspacePath: "workspace/project-map-fixture",
      storageKey: "project-map-fixture",
      createdAt: PROJECT_MAP_FIXTURE_NOW,
      updatedAt: PROJECT_MAP_FIXTURE_NOW,
      lastRunId: null,
      sourceRootHash: null,
      lensStats: [],
    },
    profile: {
      primaryLanguage: "typescript",
      languages: ["typescript"],
      shapes: ["frontend-app"],
      frameworks: [],
      interfaceKinds: ["http"],
      buildSystems: ["vite"],
    },
    lenses: [createProjectMapLensFixture()],
    nodes: defaultNodes,
    relations: [],
    tours: { steps: [], updatedAt: PROJECT_MAP_FIXTURE_NOW },
    viewState: {
      layoutPreset: "radial",
      nodeLayouts: {},
      updatedAt: PROJECT_MAP_FIXTURE_NOW,
    },
    runs: [],
    candidates: [],
    evidenceRecords: [],
    diagramDocuments: [],
    autoIngestionSettings: {
      enabled: false,
      engine: "codex",
      model: "gpt-test",
      newSessionThreshold: 5,
      checkIntervalMinutes: 30,
      applyMode: "createCandidate",
    },
    memoryCursor: {
      lastCheckedAt: PROJECT_MAP_FIXTURE_NOW,
      processedMessages: [],
      pendingMessages: [],
    },
  };

  return {
    ...base,
    ...overrides,
    manifest: overrides.manifest ?? base.manifest,
    profile: overrides.profile ?? base.profile,
    lenses: overrides.lenses ?? base.lenses,
    nodes: overrides.nodes ?? base.nodes,
    relations: overrides.relations ?? base.relations,
    runs: overrides.runs ?? base.runs,
    candidates: overrides.candidates ?? base.candidates,
    evidenceRecords: overrides.evidenceRecords ?? base.evidenceRecords,
    autoIngestionSettings: overrides.autoIngestionSettings ?? base.autoIngestionSettings,
    memoryCursor: overrides.memoryCursor ?? base.memoryCursor,
  };
}

export function getProjectMapFixtureEvidencePaths(dataset: ProjectMapDataset): string[] {
  return [
    ...dataset.nodes.flatMap((node) => [
      ...node.sources.flatMap((source) => source.path ?? []),
      ...node.detail.relatedArtifacts.flatMap((artifact) => artifact.path ?? []),
      ...(node.detail.diagramArtifacts ?? []).flatMap((diagram) => [
        diagram.path,
        ...(diagram.sourceRefs ?? []),
      ]),
    ]),
    ...(dataset.relations ?? []).flatMap((relation) =>
      relation.evidence.flatMap((record) => record.source.path ?? []),
    ),
    ...(dataset.evidenceRecords ?? []).flatMap((record) => record.source.path ?? []),
  ];
}
