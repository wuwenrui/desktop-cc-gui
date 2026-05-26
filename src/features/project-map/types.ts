export type ProjectMapLensId = string;

export type ProjectMapLensStatus = "detected" | "candidate" | "notApplicable";

export type ProjectMapLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "rust"
  | "c"
  | "cpp"
  | "mixed"
  | "unknown";

export type ProjectMapProjectShape =
  | "backend-service"
  | "frontend-app"
  | "desktop-app"
  | "cli"
  | "library"
  | "monorepo"
  | "data-project"
  | "native-app"
  | "unknown";

export type ProjectMapKnownNodeKind =
  | "module"
  | "capability"
  | "api"
  | "interface"
  | "data"
  | "record"
  | "dependency"
  | "quality"
  | "build"
  | "runtime"
  | "tech-stack"
  | "flow"
  | "risk"
  | "timeline"
  | "cross-cutting"
  | "concept";

export type ProjectMapNodeKind = ProjectMapKnownNodeKind | string;

export type ProjectMapConfidence = "high" | "medium" | "low" | "unknown";

export type ProjectMapSourceType =
  | "file"
  | "symbol"
  | "spec"
  | "commit"
  | "test"
  | "conversation";

export type ProjectMapEvidencePriority = "code" | "spec" | "tests" | "commit" | "memory";

export type ProjectMapGeneratedBy = {
  engine: string;
  model: string;
  runId: string;
};

export type ProjectMapRelatedArtifact = {
  type: ProjectMapSourceType;
  label: string;
  path?: string;
  line?: number;
  ref?: string;
};

export type ProjectMapSource = {
  type: ProjectMapSourceType;
  label: string;
  path?: string;
  line?: number;
  hash?: string;
  excerpt?: string;
};

export type ProjectMapEvidenceRecord = {
  id: string;
  source: ProjectMapSource;
  priority: ProjectMapEvidencePriority;
  observedHash: string | null;
  observedAt: string;
};

export type ProjectMapNodeDetail = {
  coreDescription: string;
  keyFacts: string[];
  keyLogic: string[];
  riskSignals: string[];
  relatedArtifacts: ProjectMapRelatedArtifact[];
};

export type ProjectMapNode = {
  id: string;
  lensId: ProjectMapLensId;
  nodeKind: ProjectMapNodeKind;
  title: string;
  summary: string;
  detail: ProjectMapNodeDetail;
  parentId?: string;
  children: string[];
  sources: ProjectMapSource[];
  confidence: ProjectMapConfidence;
  stale: boolean;
  candidate: boolean;
  lastGeneratedAt: string;
  generatedBy: ProjectMapGeneratedBy;
};

export type ProjectMapLensStats = {
  lensId: ProjectMapLensId;
  nodeCount: number;
  staleCount: number;
  candidateCount: number;
};

export type ProjectMapDetectedFramework = {
  name: string;
  confidence: ProjectMapConfidence;
  evidence: ProjectMapSource[];
};

export type ProjectMapProfile = {
  primaryLanguage: ProjectMapLanguage;
  languages: ProjectMapLanguage[];
  shapes: ProjectMapProjectShape[];
  frameworks: ProjectMapDetectedFramework[];
  interfaceKinds: Array<"http" | "rpc" | "cli" | "library" | "event" | "native" | "unknown">;
  buildSystems: string[];
};

export type ProjectMapLens = {
  id: ProjectMapLensId;
  title: string;
  shortTitle: string;
  description: string;
  status: ProjectMapLensStatus;
  confidence: ProjectMapConfidence;
  evidence: ProjectMapSource[];
};

export type ProjectMapManifest = {
  schemaVersion: number;
  projectName: string;
  workspacePath: string;
  storageKey: string;
  createdAt: string;
  updatedAt: string;
  lastRunId: string | null;
  sourceRootHash: string | null;
  lensStats: ProjectMapLensStats[];
};

export type ProjectMapRunMetadata = {
  id: string;
  kind: "global" | "node" | "auto" | "conversation";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  phase?:
    | "queued"
    | "preparingSources"
    | "askingAi"
    | "validatingOutput"
    | "writingMap"
    | "completed"
    | "failed"
    | "cancelled";
  progress?: number;
  threadId?: string | null;
  logs?: ProjectMapRunLog[];
  engine: string;
  model: string;
  startedAt: string;
  completedAt: string | null;
  scope: string;
  requestScope?: ProjectMapGenerationScope;
  readSources?: ProjectMapSource[];
  storageLocation?: ProjectMapStorageLocation;
  writePath?: string;
  error?: string | null;
};

export type ProjectMapRunLog = {
  at: string;
  phase: NonNullable<ProjectMapRunMetadata["phase"]>;
  message: string;
};

export type ProjectMapStorageLocation = "global" | "project";

export type ProjectMapGenerationScope =
  | { kind: "global"; lensIds: ProjectMapLensId[] }
  | { kind: "node"; nodeId: string; includeDescendants: boolean }
  | { kind: "auto"; messageHashes: string[] }
  | { kind: "conversation"; memoryId: string };

export type ProjectMapGenerationRequest = {
  id: string;
  kind: ProjectMapRunMetadata["kind"];
  engine: string;
  model: string;
  scope: ProjectMapGenerationScope;
  readSources: ProjectMapSource[];
  storageLocation: ProjectMapStorageLocation;
  writePath: string;
  createdAt: string;
};

export type ProjectMapNodePatch = {
  nodeId: string;
  summary?: string;
  detail?: Partial<ProjectMapNodeDetail>;
  sources?: ProjectMapSource[];
  confidence?: ProjectMapConfidence;
  stale?: boolean;
  candidate?: boolean;
};

export type ProjectMapCandidate = {
  id: string;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
  updatedAt: string;
  source: "global" | "node" | "auto" | "conversation";
  targetLensId: ProjectMapLensId;
  targetNodeId?: string | null;
  patch: ProjectMapNodePatch;
  evidence: ProjectMapEvidenceRecord[];
};

export type ProjectMapAutoIngestionSettings = {
  enabled: boolean;
  engine: string;
  model: string;
  newSessionThreshold: number;
  checkIntervalMinutes: number;
  applyMode: "autoApplyEvidenceBacked" | "createCandidate";
};

export type ProjectMapProcessedMemoryMessage = {
  sessionId: string;
  messageHash: string;
  processedAt?: string;
  runId?: string;
};

export type ProjectMapMemoryIngestionCursor = {
  lastCheckedAt: string;
  processedMessages: ProjectMapProcessedMemoryMessage[];
  pendingMessages: ProjectMapProcessedMemoryMessage[];
  lastRunId?: string;
};

export type ProjectMapDataset = {
  manifest: ProjectMapManifest;
  profile: ProjectMapProfile;
  lenses: ProjectMapLens[];
  nodes: ProjectMapNode[];
  runs: ProjectMapRunMetadata[];
  candidates?: ProjectMapCandidate[];
  evidenceRecords?: ProjectMapEvidenceRecord[];
  autoIngestionSettings: ProjectMapAutoIngestionSettings;
  memoryCursor: ProjectMapMemoryIngestionCursor;
};
