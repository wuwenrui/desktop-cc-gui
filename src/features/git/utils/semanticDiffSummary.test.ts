import { describe, expect, it } from "vitest";
import { buildSemanticDiffSummary } from "./semanticDiffSummary";

describe("buildSemanticDiffSummary", () => {
  it("extracts concrete Spring exception handler behavior from a Java hunk", () => {
    const summary = buildSemanticDiffSummary([
      {
        path: "src/main/java/com/example/demo/exception/GlobalExceptionHandler.java",
        status: "M",
        diff: [
          "@@ -76,0 +77,10 @@",
          "+    /**",
          "+     * 处理操作日志不存在异常",
          "+     */",
          "+    @ExceptionHandler(OperationLogNotFoundException.class)",
          "+    public ResponseEntity<ApiResponse<Void>> handleOperationLogNotFoundException(OperationLogNotFoundException e) {",
          "+        return ResponseEntity",
          "+                .status(HttpStatus.NOT_FOUND)",
          "+                .body(ApiResponse.<Void>error(404, e.getMessage()));",
          "+    }",
          "+",
        ].join("\n"),
      },
    ]);

    expect(summary.intent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.intent.springExceptionHandler",
          values: expect.objectContaining({
            exception: "OperationLogNotFoundException",
            method: "handleOperationLogNotFoundException",
            evidence: "src/main/java/com/example/demo/exception/GlobalExceptionHandler.java:80",
          }),
        }),
      ]),
    );
    expect(summary.behavior).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.behavior.springExceptionStatus",
          values: expect.objectContaining({
            exception: "OperationLogNotFoundException",
            status: "404 NOT_FOUND",
          }),
        }),
        expect.objectContaining({
          textKey: "git.semanticDiff.behavior.apiResponseError",
          values: expect.objectContaining({
            method: "handleOperationLogNotFoundException",
            code: 404,
          }),
        }),
      ]),
    );
    expect(summary.intent.map((item) => item.textKey)).not.toContain(
      "git.semanticDiff.intent.noConcreteFacts",
    );
  });

  it("extracts exported TypeScript declarations instead of only file categories", () => {
    const summary = buildSemanticDiffSummary([
      {
        path: "src/features/git/utils/semanticDiffSummary.ts",
        status: "M",
        diff: [
          "@@ -1,0 +1,2 @@",
          "+export type SemanticDiffSummary = { intent: string[] };",
          "+export function buildSemanticDiffSummary() {}",
        ].join("\n"),
      },
    ]);

    expect(summary.intent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.intent.export",
          values: expect.objectContaining({ symbol: "SemanticDiffSummary" }),
        }),
        expect.objectContaining({
          textKey: "git.semanticDiff.intent.export",
          values: expect.objectContaining({ symbol: "buildSemanticDiffSummary" }),
        }),
      ]),
    );
  });

  it("extracts React component, hook, state, and handler facts", () => {
    const summary = buildSemanticDiffSummary([
      {
        path: "src/features/session-activity/components/ReviewPanel.tsx",
        status: "M",
        diff: [
          "@@ -10,0 +11,5 @@",
          "+export function ReviewPanel() {",
          "+  const [activeTab, setActiveTab] = useState('artifacts');",
          "+  const handleTabChange = () => setActiveTab('semantic');",
          "+  return null;",
          "+}",
          "+export function useReviewFacts() { return []; }",
        ].join("\n"),
      },
    ]);

    expect(summary.intent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.intent.reactComponent",
          values: expect.objectContaining({ component: "ReviewPanel" }),
        }),
        expect.objectContaining({
          textKey: "git.semanticDiff.intent.reactHook",
          values: expect.objectContaining({ hook: "useReviewFacts" }),
        }),
      ]),
    );
    expect(summary.behavior).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.behavior.reactState",
          values: expect.objectContaining({ state: "activeTab" }),
        }),
        expect.objectContaining({
          textKey: "git.semanticDiff.behavior.eventHandler",
          values: expect.objectContaining({ handler: "handleTabChange" }),
        }),
      ]),
    );
  });

  it("recognizes test and spec evidence without claiming commands passed", () => {
    const summary = buildSemanticDiffSummary([
      {
        path: "src/features/git/utils/semanticDiffSummary.test.ts",
        status: "A",
        diff: "@@ -0,0 +1,2 @@\n+it('works', () => {})\n+expect(true).toBe(true)",
      },
      {
        path: "openspec/changes/add-semantic-diff-review/specs/git-panel-diff-view/spec.md",
        status: "A",
        diff: "@@ -0,0 +1 @@\n+## ADDED Requirements",
      },
    ]);

    expect(summary.validation.map((item) => item.textKey)).toEqual(
      expect.arrayContaining([
        "git.semanticDiff.validation.testFiles",
        "git.semanticDiff.validation.specFiles",
        "git.semanticDiff.validation.notConnected",
      ]),
    );
    expect(summary.risks.map((item) => item.textKey)).not.toContain(
      "git.semanticDiff.risk.noTests",
    );
    expect(summary.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.validation.testCase",
          values: expect.objectContaining({ name: "works" }),
        }),
        expect.objectContaining({
          textKey: "git.semanticDiff.validation.assertion",
        }),
      ]),
    );
  });

  it("connects same-turn validation commands without requiring test-file changes", () => {
    const summary = buildSemanticDiffSummary({
      entries: [
        {
          path: "src/App.tsx",
          status: "M",
          diff: "@@ -1 +1 @@\n-export const old = 1;\n+export const next = 2;",
        },
      ],
      validationEvidence: [
        {
          eventId: "command:test",
          commandText: "npx vitest run src/App.test.tsx",
          commandDescription: "Run focused tests",
          status: "completed",
        },
        {
          eventId: "command:lint",
          commandText: "npm run lint",
          status: "failed",
        },
      ],
    });

    expect(summary.validation.map((item) => item.textKey)).toEqual(
      expect.arrayContaining([
        "git.semanticDiff.validation.commandPassed",
        "git.semanticDiff.validation.commandFailed",
      ]),
    );
    expect(summary.validation.map((item) => item.textKey)).not.toContain(
      "git.semanticDiff.validation.notConnected",
    );
    expect(summary.risks.map((item) => item.textKey)).toContain(
      "git.semanticDiff.risk.validationFailed",
    );
    expect(summary.validation.find((item) => item.textKey === "git.semanticDiff.validation.commandPassed")?.evidenceRefs?.[0]).toEqual(
      expect.objectContaining({ type: "command", id: "command:test", status: "completed" }),
    );
  });

  it("extracts changed config keys", () => {
    const summary = buildSemanticDiffSummary([
      {
        path: "package.json",
        status: "M",
        diff: "@@ -1,0 +1,2 @@\n+\"scripts\": {\"lint\":\"eslint .\"}\n+\"dependencies\": {}",
      },
    ]);

    expect(summary.behavior).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.behavior.configKey",
          values: expect.objectContaining({ key: "scripts" }),
        }),
      ]),
    );
  });

  it("accepts AI review facts only when they carry evidence refs", () => {
    const summary = buildSemanticDiffSummary({
      entries: [
        {
          path: "src/App.tsx",
          status: "M",
          diff: "@@ -1 +1 @@\n-old\n+new",
        },
      ],
      aiReview: {
        source: "ai",
        generatedAt: 1,
        facts: [
          {
            category: "intent",
            text: "Aligns the UI with the requested review surface.",
            confidence: "medium",
            evidenceRefs: [{ type: "file", id: "src/App.tsx", path: "src/App.tsx" }],
          },
          {
            category: "risk",
            text: "Unsupported claim without evidence.",
            confidence: "low",
            evidenceRefs: [],
          },
        ],
      },
    });

    expect(summary.intent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.ai.fact",
          source: "ai",
          values: expect.objectContaining({
            text: "Aligns the UI with the requested review surface.",
          }),
        }),
      ]),
    );
    expect(summary.risks).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          textKey: "git.semanticDiff.ai.fact",
          values: expect.objectContaining({ text: "Unsupported claim without evidence." }),
        }),
      ]),
    );
  });

  it("flags config and deleted-file risk", () => {
    const summary = buildSemanticDiffSummary([
      {
        path: "package.json",
        status: "M",
        diff: "@@ -1 +1 @@\n-\"old\": true\n+\"old\": false",
      },
      {
        path: "src/legacy.ts",
        status: "D",
        diff: "@@ -1 +0,0 @@\n-export const legacy = true;",
      },
    ]);

    expect(summary.behavior.map((item) => item.textKey)).toContain(
      "git.semanticDiff.behavior.deleted",
    );
    expect(summary.risks.map((item) => item.textKey)).toEqual(
      expect.arrayContaining([
        "git.semanticDiff.risk.config",
        "git.semanticDiff.risk.deleted",
      ]),
    );
  });
});
