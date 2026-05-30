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

export type ProjectMapPreferredLanguage = "zh" | "en";

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

export type ProjectMapDiagramArtifact = {
  id: string;
  label: string;
  path: string;
  kind?: "flowchart" | "sequence" | "state" | "class" | "er" | "timeline" | "mindmap" | "other" | string;
  summary?: string;
  sourceRefs?: string[];
};

export type ProjectMapDiagramDocument = {
  id: string;
  nodeId: string;
  title: string;
  kind: NonNullable<ProjectMapDiagramArtifact["kind"]>;
  summary: string;
  sourceRefs: string[];
  relativePath: string;
  path: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
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
  diagramArtifacts?: ProjectMapDiagramArtifact[];
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

export type ProjectMapLayoutPreset = "radial" | "tree" | "force";

export type ProjectMapNodeLayout = {
  x: number;
  y: number;
  pinned?: boolean;
  updatedAt?: string;
};

export type ProjectMapViewState = {
  layoutPreset: ProjectMapLayoutPreset;
  nodeLayouts: Record<string, ProjectMapNodeLayout>;
  updatedAt?: string;
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

export type ProjectMapRunFailureCategory =
  | "output_parse_failed"
  | "ownership_mismatch"
  | "evidence_read_failed"
  | "persistence_failed"
  | "cancelled";

export type ProjectMapRunOwnership = {
  workspaceId: string | null;
  workspacePath: string;
  storageKey: string;
  storageLocation: ProjectMapStorageLocation;
};

export type ProjectMapOrganizerRunResult = {
  unassignedCount: number;
  candidateCount: number;
  skippedCount: number;
  unsafeCount: number;
  skips?: ProjectMapOrganizerRunItem[];
  unsafe?: ProjectMapOrganizerRunItem[];
};

export type ProjectMapOrganizerRunItem = {
  nodeId: string;
  title: string;
  reason: string;
};

export type ProjectMapRunMetadata = {
  id: string;
  kind: "global" | "node" | "auto" | "conversation" | "organizer";
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
  generationIntent?: ProjectMapGenerationIntent;
  preferredLanguage?: ProjectMapPreferredLanguage;
  readSources?: ProjectMapSource[];
  storageLocation?: ProjectMapStorageLocation;
  ownership?: ProjectMapRunOwnership;
  writePath?: string;
  autoIngestion?: ProjectMapAutoIngestionRunContext;
  organizerResult?: ProjectMapOrganizerRunResult;
  error?: string | null;
  failureCategory?: ProjectMapRunFailureCategory | null;
};

export type ProjectMapRunLog = {
  at: string;
  phase: NonNullable<ProjectMapRunMetadata["phase"]>;
  message: string;
};

export type ProjectMapStorageLocation = "global" | "project";

export type ProjectMapGenerationIntent =
  | "global"
  | "completeNode"
  | "calibrateNode"
  | "autoIngestion"
  | "organizeUnassigned";

export type ProjectMapGenerationScope =
  | { kind: "global"; lensIds: ProjectMapLensId[] }
  | { kind: "node"; nodeId: string; includeDescendants: boolean }
  | { kind: "auto"; messageHashes: string[] }
  | { kind: "conversation"; memoryId: string }
  | { kind: "organizer"; unassignedCount: number };

export type ProjectMapGenerationRequest = {
  id: string;
  kind: ProjectMapRunMetadata["kind"];
  engine: string;
  model: string;
  scope: ProjectMapGenerationScope;
  generationIntent: ProjectMapGenerationIntent;
  preferredLanguage: ProjectMapPreferredLanguage;
  readSources: ProjectMapSource[];
  storageLocation: ProjectMapStorageLocation;
  ownership?: ProjectMapRunOwnership;
  writePath: string;
  createdAt: string;
  autoIngestion?: ProjectMapAutoIngestionRunContext;
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

export type ProjectMapCandidateKind = "contentPatch" | "parentMove";

export type ProjectMapParentMoveCandidate = {
  nodeId: string;
  fromParentId: string;
  suggestedParentId: string;
  confidence: ProjectMapConfidence;
  reason: string;
};

export type ProjectMapCandidate = {
  id: string;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
  updatedAt: string;
  source: "global" | "node" | "auto" | "conversation" | "organizer";
  kind?: ProjectMapCandidateKind;
  targetLensId: ProjectMapLensId;
  targetNodeId?: string | null;
  patch: ProjectMapNodePatch;
  move?: ProjectMapParentMoveCandidate;
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

export type ProjectMapAutoIngestionMemoryEvidence = {
  memoryId: string;
  sessionId: string;
  messageHash: string;
  title: string;
  summary: string;
  detail?: string | null;
  cleanText?: string | null;
  rawText?: string | null;
  userInput?: string | null;
  assistantResponse?: string | null;
  workspacePath?: string | null;
  source: string;
  updatedAt: number;
};

export type ProjectMapAutoIngestionRunContext = {
  applyMode: ProjectMapAutoIngestionSettings["applyMode"];
  consumedMessages: ProjectMapProcessedMemoryMessage[];
  memoryEvidence: ProjectMapAutoIngestionMemoryEvidence[];
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
  viewState?: ProjectMapViewState;
  runs: ProjectMapRunMetadata[];
  candidates?: ProjectMapCandidate[];
  evidenceRecords?: ProjectMapEvidenceRecord[];
  diagramDocuments?: ProjectMapDiagramDocument[];
  autoIngestionSettings: ProjectMapAutoIngestionSettings;
  memoryCursor: ProjectMapMemoryIngestionCursor;
};
