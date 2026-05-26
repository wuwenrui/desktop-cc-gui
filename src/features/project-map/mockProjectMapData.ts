import type {
  ProjectMapDataset,
  ProjectMapLens,
  ProjectMapLensId,
  ProjectMapLensStats,
  ProjectMapNode,
  ProjectMapNodeDetail,
  ProjectMapRelatedArtifact,
  ProjectMapSource,
} from "./types";

const generatedBy = {
  engine: "codex",
  model: "mock-xray-v3-profile-lens",
  runId: "run_mock_2026_05_26_profile_lens",
};

const baseGeneratedAt = "2026-05-26T10:15:00+08:00";

function file(label: string, path: string): ProjectMapSource {
  return { type: "file", label, path, hash: `mock-${label}` };
}

function symbol(label: string, path: string, line: number): ProjectMapSource {
  return { type: "symbol", label, path, line, hash: `mock-${label}` };
}

function test(label: string, path: string): ProjectMapSource {
  return { type: "test", label, path, hash: `mock-${label}` };
}

function spec(label: string, path: string): ProjectMapSource {
  return { type: "spec", label, path, hash: `mock-${label}` };
}

function detail(
  coreDescription: string,
  keyFacts: string[],
  keyLogic: string[],
  riskSignals: string[],
  relatedArtifacts: ProjectMapRelatedArtifact[],
): ProjectMapNodeDetail {
  return {
    coreDescription,
    keyFacts,
    keyLogic,
    riskSignals,
    relatedArtifacts,
  };
}

function hub(
  id: string,
  lensId: ProjectMapLensId,
  nodeKind: ProjectMapNode["nodeKind"],
  title: string,
  summary: string,
  children: string[],
  riskSignals: string[] = [],
): ProjectMapNode {
  return {
    id,
    lensId,
    nodeKind,
    title,
    summary,
    detail: detail(
      summary,
      [
        "该视角来自 Project Profile 和 evidence scan，不是 UI 固定枚举。",
        "节点只展示结构摘要，具体文件、symbol 和 source 留在 detail panel。",
      ],
      [
        "先识别项目形态，再决定该视角是否 detected、candidate 或 not applicable。",
        "同一 workspace 可同时拥有多个语言、多个 build system 和多种 API surface。",
      ],
      riskSignals,
      [
        { type: "file", label: "Package / build manifests", path: "package.json / pyproject.toml / go.mod / CMakeLists.txt" },
        { type: "spec", label: "Project xray behavior", path: "openspec/changes/add-project-xray-panel/specs/project-xray-panel/spec.md" },
      ],
    ),
    parentId: "project-core",
    children,
    sources: [file("workspace manifests", "package.json / pyproject.toml / go.mod / CMakeLists.txt")],
    confidence: "high",
    stale: false,
    candidate: false,
    lastGeneratedAt: baseGeneratedAt,
    generatedBy,
  };
}

function leaf(
  id: string,
  lensId: ProjectMapLensId,
  nodeKind: ProjectMapNode["nodeKind"],
  title: string,
  summary: string,
  parentId: string,
  sources: ProjectMapSource[],
  options: {
    confidence?: ProjectMapNode["confidence"];
    stale?: boolean;
    candidate?: boolean;
    keyFacts?: string[];
    keyLogic?: string[];
    riskSignals?: string[];
    relatedArtifacts?: ProjectMapRelatedArtifact[];
  } = {},
): ProjectMapNode {
  return {
    id,
    lensId,
    nodeKind,
    title,
    summary,
    detail: detail(
      summary,
      options.keyFacts ?? ["该节点由 mock evidence 聚合生成，真实版本会从代码索引和 AI evidence gate 产出。"],
      options.keyLogic ?? ["分类依据来自 manifest、目录结构、symbol、test 和 spec 的组合证据。"],
      options.riskSignals ?? [],
      options.relatedArtifacts ?? sources.map((source) => ({
        type: source.type,
        label: source.label,
        path: source.path,
        line: source.line,
      })),
    ),
    parentId,
    children: [],
    sources,
    confidence: options.confidence ?? "medium",
    stale: options.stale ?? false,
    candidate: options.candidate ?? false,
    lastGeneratedAt: baseGeneratedAt,
    generatedBy,
  };
}

const lenses: ProjectMapLens[] = [
  {
    id: "overview",
    title: "总览 Overview",
    shortTitle: "Overview",
    description: "项目画像、语言、框架、接口形态和主要风险的入口。",
    status: "detected",
    confidence: "high",
    evidence: [file("workspace root", ".")],
  },
  {
    id: "business",
    title: "业务能力 Business Capabilities",
    shortTitle: "Business",
    description: "从 package、route、service、model、test 和文档聚合业务能力。",
    status: "candidate",
    confidence: "medium",
    evidence: [file("feature folders", "src/**")],
  },
  {
    id: "modules",
    title: "模块结构 Modules",
    shortTitle: "Modules",
    description: "按 source roots、namespace、package、target 和 feature slice 建立模块图。",
    status: "detected",
    confidence: "high",
    evidence: [file("source roots", "src/**")],
  },
  {
    id: "api-surface",
    title: "接口表面 API Surface",
    shortTitle: "API",
    description: "统一表达 HTTP、RPC、CLI、library exports、native headers 和 event topics。",
    status: "detected",
    confidence: "high",
    evidence: [symbol("public entries", "src/**", 1)],
  },
  {
    id: "data-model",
    title: "数据模型 Data Model",
    shortTitle: "Data",
    description: "模型、DTO、Entity、schema、migration、message payload 的结构视角。",
    status: "candidate",
    confidence: "medium",
    evidence: [file("models", "src/**/models.*")],
  },
  {
    id: "runtime-build",
    title: "运行与构建 Runtime & Build",
    shortTitle: "Runtime",
    description: "启动、构建、测试、配置、容器和 native build system。",
    status: "detected",
    confidence: "high",
    evidence: [file("build manifests", "package.json / Makefile / CMakeLists.txt")],
  },
  {
    id: "dependencies",
    title: "依赖集成 Dependencies",
    shortTitle: "Deps",
    description: "数据库、缓存、队列、SDK、外部 HTTP service 和 native library。",
    status: "candidate",
    confidence: "medium",
    evidence: [file("dependency manifests", "package.json / requirements.txt / go.mod")],
  },
  {
    id: "tests-quality",
    title: "测试与质量 Tests & Quality",
    shortTitle: "Quality",
    description: "unit、integration、contract、lint、typecheck、coverage 和质量门禁。",
    status: "detected",
    confidence: "high",
    evidence: [test("test files", "src/**/*.test.*")],
  },
  {
    id: "risk",
    title: "风险 Risk",
    shortTitle: "Risk",
    description: "过期证据、低置信分类、接口未覆盖、构建漂移和高变更热区。",
    status: "detected",
    confidence: "high",
    evidence: [spec("tasks", "openspec/changes/add-project-xray-panel/tasks.md")],
  },
  {
    id: "evidence",
    title: "证据 Evidence",
    shortTitle: "Evidence",
    description: "所有 claim 回到 file、symbol、test、spec、commit 或 conversation。",
    status: "detected",
    confidence: "high",
    evidence: [spec("evidence gate", "openspec/changes/add-project-xray-panel/specs/project-xray-panel/spec.md")],
  },
];

const nodes: ProjectMapNode[] = [
  {
    id: "project-core",
    lensId: "overview",
    nodeKind: "concept",
    title: "项目画像 Project Profile",
    summary: "先识别语言、形态、框架、接口和构建系统，再生成当前项目自己的知识地图。",
    detail: detail(
      "Project Knowledge Map 的总览不是固定层级，而是 profile-driven lens registry：不同语言和项目形态会得到不同 lens 组合。",
      [
        "当前 mock 表达 polyglot workspace：TypeScript 为主，同时保留 Python、Go、C/C++ 等项目形态的兼容策略。",
        "API Surface 统一承载 HTTP、RPC、CLI、library export、native header、event topic。",
        "Business Modules 不只看目录名，会结合 route、service、model、test、README 和 spec。",
      ],
      [
        "Fingerprint 先生成 Project Profile。",
        "Lens Registry 根据 profile 选择 detected / candidate / notApplicable 视角。",
        "Graph Builder 只渲染 detected 和 candidate lens，detail panel 展示证据。",
      ],
      ["如果继续使用固定 layer enum，后续 AI generation 会把不同技术栈误塞进同一套分类。"],
      [
        { type: "file", label: "ProjectMap types", path: "src/features/project-map/types.ts" },
        { type: "spec", label: "Project xray spec", path: "openspec/changes/add-project-xray-panel/specs/project-xray-panel/spec.md" },
      ],
    ),
    children: [
      "hub-business",
      "hub-modules",
      "hub-api",
      "hub-data",
      "hub-runtime",
      "hub-dependencies",
      "hub-quality",
      "hub-risk",
      "hub-evidence",
    ],
    sources: [file("workspace root", "."), spec("Project xray spec", "openspec/changes/add-project-xray-panel/specs/project-xray-panel/spec.md")],
    confidence: "high",
    stale: false,
    candidate: false,
    lastGeneratedAt: baseGeneratedAt,
    generatedBy,
  },
  hub("hub-business", "business", "capability", "业务能力 Business Capabilities", "按用户能力和业务语义聚合模块，不把目录树误当知识地图。", ["business-auth", "business-workspace", "business-reporting"]),
  hub("hub-modules", "modules", "module", "模块结构 Modules", "从 source roots、package、namespace、target 和 feature slice 归纳模块边界。", ["module-frontend", "module-backend", "module-native"]),
  hub("hub-api", "api-surface", "api", "接口表面 API Surface", "把 HTTP、RPC、CLI、library export、native header 和 event topic 放在同一视角。", ["api-http", "api-cli", "api-library", "api-event"]),
  hub("hub-data", "data-model", "data", "数据模型 Data Model", "识别 Entity、DTO、schema、migration、message payload 和 config model。", ["data-entity", "data-dto", "data-schema"]),
  hub("hub-runtime", "runtime-build", "build", "运行与构建 Runtime & Build", "识别 package script、Makefile、CMake、Gradle、Cargo、Docker 和 CI 入口。", ["runtime-package-scripts", "runtime-native-build", "runtime-container"]),
  hub("hub-dependencies", "dependencies", "dependency", "依赖集成 Dependencies", "聚合 database、cache、queue、HTTP client、SDK 和 native library。", ["dep-database", "dep-cache-queue", "dep-external-sdk"]),
  hub("hub-quality", "tests-quality", "quality", "测试与质量 Tests & Quality", "展示 test pyramid、lint/typecheck、contract test 和未覆盖热区。", ["quality-unit", "quality-contract", "quality-ci"]),
  hub("hub-risk", "risk", "risk", "风险 Risk", "突出低置信分类、接口未覆盖、build drift 和 stale evidence。", ["risk-taxonomy-drift", "risk-api-coverage", "risk-build-drift"], ["跨语言项目最容易把 framework-specific 规则误判成通用规则。"]),
  hub("hub-evidence", "evidence", "concept", "证据链 Evidence", "所有确定性 claim 必须能回到 source；无证据只能 candidate 或 unknown。", ["evidence-code", "evidence-tests", "evidence-specs"]),

  leaf("business-auth", "business", "capability", "身份与权限 Identity & Access", "从 auth route、middleware、guard、policy、test 聚合身份能力。", "hub-business", [file("auth folders", "src/**/auth/**")], {
    confidence: "medium",
    candidate: true,
    riskSignals: ["仅靠目录名不能确认业务边界，需要 route/service/test 共同支撑。"],
  }),
  leaf("business-workspace", "business", "capability", "工作区 Workspace Domain", "以 workspace/session/project 相关入口聚合核心工作流。", "hub-business", [symbol("workspace service", "src/**/workspace*", 1)]),
  leaf("business-reporting", "business", "capability", "报表与导出 Reporting", "从 export/report/chart 相关 symbol 候选出报表能力。", "hub-business", [file("report candidates", "src/**/report*")], {
    confidence: "low",
    candidate: true,
  }),

  leaf("module-frontend", "modules", "module", "Frontend Feature Slices", "React / Vue / Svelte 等前端项目按 routes、pages、features 和 shared UI 切分。", "hub-modules", [file("frontend source", "src/features/**")], {
    confidence: "high",
  }),
  leaf("module-backend", "modules", "module", "Backend Service Modules", "Java、Go、Python、Node service 可按 controller/router、service、repository、domain 聚合。", "hub-modules", [file("backend source", "server/**")]),
  leaf("module-native", "modules", "module", "Native / Systems Targets", "C/C++/Rust 项目按 CMake target、crate、include boundary 和 namespace 聚合。", "hub-modules", [file("native manifests", "CMakeLists.txt / Cargo.toml")], {
    confidence: "medium",
  }),

  leaf("api-http", "api-surface", "api", "HTTP / RPC Endpoints", "Controller、router、handler、GraphQL resolver、gRPC service 统一进入 endpoint map。", "hub-api", [symbol("route handlers", "src/**/routes.*", 1)], {
    confidence: "high",
    keyFacts: ["Endpoint 节点应连接 request/response DTO、service method、test 和 auth guard。"],
  }),
  leaf("api-cli", "api-surface", "api", "CLI Commands", "命令、subcommand、flags、stdin/stdout contract 是 CLI 项目的公开接口。", "hub-api", [symbol("command entry", "cmd/**", 1)]),
  leaf("api-library", "api-surface", "api", "Library Exports / Headers", "SDK、package export、public class、C/C++ header 都是 library API surface。", "hub-api", [file("public exports", "src/index.ts / include/**/*.h")]),
  leaf("api-event", "api-surface", "api", "Events / Topics", "Kafka、RabbitMQ、Redis stream、domain event 和 webhook 归到 event API。", "hub-api", [symbol("event producers", "src/**/events*", 1)], {
    confidence: "low",
    candidate: true,
  }),

  leaf("data-entity", "data-model", "data", "Entities / Models", "Entity、ORM model、struct、dataclass、protobuf message 表达核心数据对象。", "hub-data", [file("models", "src/**/model*")]),
  leaf("data-dto", "data-model", "data", "DTO / Schema Contracts", "Request、Response、DTO、Pydantic schema、TypeScript type 和 protobuf schema 进入 contract map。", "hub-data", [symbol("DTO contracts", "src/**/dto*", 1)]),
  leaf("data-schema", "data-model", "data", "Persistence Schema", "migration、SQL schema、Prisma schema、JPA mapping、NoSQL collection 是存储证据。", "hub-data", [file("migrations", "migrations/**")], {
    confidence: "low",
    candidate: true,
  }),

  leaf("runtime-package-scripts", "runtime-build", "build", "Package Scripts / Task Runner", "package.json、pyproject、go.mod、Gradle、Maven、Cargo scripts 表达运行入口。", "hub-runtime", [file("package scripts", "package.json")], {
    confidence: "high",
  }),
  leaf("runtime-native-build", "runtime-build", "build", "Native Build Targets", "CMake target、Makefile、Cargo crate、cc flags 和 generated bindings 归入 native build。", "hub-runtime", [file("CMake", "CMakeLists.txt")]),
  leaf("runtime-container", "runtime-build", "build", "Container / Deploy Runtime", "Dockerfile、compose、helm、CI deploy job 表达部署运行形态。", "hub-runtime", [file("Docker", "Dockerfile")], {
    confidence: "low",
    candidate: true,
  }),

  leaf("dep-database", "dependencies", "dependency", "Database", "从 datasource、ORM config、migration、repository import 识别数据库依赖。", "hub-dependencies", [file("datasource config", "config/**")]),
  leaf("dep-cache-queue", "dependencies", "dependency", "Cache / Queue", "Redis、Kafka、RabbitMQ、Celery、Sidekiq、BullMQ 等进入 async integration map。", "hub-dependencies", [file("queue config", "config/**")], {
    confidence: "low",
    candidate: true,
  }),
  leaf("dep-external-sdk", "dependencies", "dependency", "External SDK / HTTP Client", "第三方 SDK、OpenAPI client、native library link 都作为外部边界展示。", "hub-dependencies", [symbol("external client", "src/**/client*", 1)]),

  leaf("quality-unit", "tests-quality", "quality", "Unit Tests", "按 test file 与 source symbol 的映射展示单元测试覆盖。", "hub-quality", [test("unit tests", "src/**/*.test.*")], {
    confidence: "high",
  }),
  leaf("quality-contract", "tests-quality", "quality", "Contract / Integration Tests", "接口、数据库、message schema 和 CLI contract 需要更强验证。", "hub-quality", [test("contract tests", "tests/**")], {
    confidence: "medium",
  }),
  leaf("quality-ci", "tests-quality", "quality", "CI Quality Gates", "lint、typecheck、pytest、go test、ctest、cargo test、openspec validate 统一表达质量门禁。", "hub-quality", [file("CI", ".github/workflows/**")]),

  leaf("risk-taxonomy-drift", "risk", "risk", "分类漂移 Taxonomy Drift", "固定 layer 会让不同项目共享错误分类，是当前需要优先修掉的产品风险。", "hub-risk", [spec("design", "openspec/changes/add-project-xray-panel/design.md")], {
    confidence: "high",
    stale: true,
    candidate: true,
    riskSignals: ["UI 之前把 lens 写成固定 enum，和跨语言项目需求冲突。"],
  }),
  leaf("risk-api-coverage", "risk", "risk", "接口覆盖缺口 API Coverage Gap", "API Surface 识别后需要连接测试，否则只能显示 candidate confidence。", "hub-risk", [test("focused tests", "src/features/project-map/components/ProjectMapPanel.test.tsx")], {
    confidence: "medium",
  }),
  leaf("risk-build-drift", "risk", "risk", "构建漂移 Build Drift", "多 build system 项目容易出现脚本、CI 和本地命令不一致。", "hub-risk", [file("build manifests", "package.json / Makefile / CMakeLists.txt")], {
    confidence: "medium",
    stale: true,
  }),

  leaf("evidence-code", "evidence", "concept", "Code Evidence", "代码和 symbol 是最高优先级证据，用于支撑确定性项目事实。", "hub-evidence", [symbol("symbols", "src/**", 1)], {
    confidence: "high",
  }),
  leaf("evidence-tests", "evidence", "concept", "Test Evidence", "测试证明行为存在，但不能单独证明所有实现细节。", "hub-evidence", [test("tests", "src/**/*.test.*")]),
  leaf("evidence-specs", "evidence", "concept", "Spec / Memory Evidence", "spec、commit、conversation 可以补充背景，但 memory alone 不能升高代码事实置信度。", "hub-evidence", [spec("OpenSpec", "openspec/changes/add-project-xray-panel/specs/project-xray-panel/spec.md")]),
];

const lensStats = lenses.map((lens): ProjectMapLensStats => {
  const lensNodes = nodes.filter((node) => node.lensId === lens.id);
  return {
    lensId: lens.id,
    nodeCount: lensNodes.length,
    staleCount: lensNodes.filter((node) => node.stale).length,
    candidateCount: lensNodes.filter((node) => node.candidate).length,
  };
});

export const mockProjectMapData: ProjectMapDataset = {
  manifest: {
    schemaVersion: 2,
    projectName: "polyglot-demo",
    workspacePath: "/workspace/polyglot-demo",
    storageKey: "polyglot-demo-mock",
    createdAt: baseGeneratedAt,
    updatedAt: baseGeneratedAt,
    lastRunId: generatedBy.runId,
    sourceRootHash: "mock-source-root-hash",
    lensStats,
  },
  profile: {
    primaryLanguage: "mixed",
    languages: ["typescript", "python", "go", "cpp"],
    shapes: ["frontend-app", "backend-service", "cli", "library"],
    frameworks: [
      { name: "React / Vite candidate", confidence: "medium", evidence: [file("package.json", "package.json")] },
      { name: "FastAPI / Django candidate", confidence: "low", evidence: [file("pyproject", "pyproject.toml")] },
      { name: "Go service candidate", confidence: "low", evidence: [file("go.mod", "go.mod")] },
      { name: "CMake native target candidate", confidence: "low", evidence: [file("CMake", "CMakeLists.txt")] },
    ],
    interfaceKinds: ["http", "cli", "library", "event"],
    buildSystems: ["npm scripts", "pyproject", "go module", "CMake"],
  },
  lenses,
  nodes,
  runs: [
    {
      id: generatedBy.runId,
      kind: "global",
      status: "completed",
      engine: generatedBy.engine,
      model: generatedBy.model,
      startedAt: baseGeneratedAt,
      completedAt: baseGeneratedAt,
      scope: "profile+lens mock framework",
    },
  ],
  autoIngestionSettings: {
    enabled: false,
    engine: generatedBy.engine,
    model: generatedBy.model,
    newSessionThreshold: 5,
    checkIntervalMinutes: 30,
    applyMode: "createCandidate",
  },
  memoryCursor: {
    lastCheckedAt: baseGeneratedAt,
    processedMessages: [],
    pendingMessages: [],
    lastRunId: generatedBy.runId,
  },
};
