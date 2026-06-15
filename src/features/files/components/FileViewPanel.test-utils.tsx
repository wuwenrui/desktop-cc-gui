import { vi } from "vitest";

export const mockCodeMirrorDispatch = vi.fn();
export const mockCodeMirrorExtensionsSnapshots: unknown[] = [];
export const mockCodeMirrorExtensionTokenSnapshots: string[][] = [];
export const mockOpenNewDetachedFileExplorerWindow = vi.fn(async () => "created" as const);

function createDoc(text: string) {
  const lines = text.split("\n");
  const starts: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    starts.push(cursor);
    cursor += line.length + 1;
  }
  const lineFor = (lineNumber: number) => {
    const safeLine = Math.min(Math.max(lineNumber, 1), lines.length);
    const lineText = lines[safeLine - 1] ?? "";
    const from = starts[safeLine - 1] ?? 0;
    return {
      number: safeLine,
      from,
      to: from + lineText.length,
      length: lineText.length,
      text: lineText,
    };
  };
  const lineAt = (offset: number) => {
    const safeOffset = Math.min(Math.max(offset, 0), text.length);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (safeOffset >= (starts[index] ?? 0)) {
        return lineFor(index + 1);
      }
    }
    return lineFor(1);
  };
  return {
    length: text.length,
    lines: lines.length,
    line: lineFor,
    lineAt,
  };
}

vi.mock("@uiw/react-codemirror", async () => {
  const React = await import("react");
  const MockCodeMirror = React.forwardRef<
    { view: any },
    {
      value?: string;
      onChange?: (value: string) => void;
      onCreateEditor?: (view: any, state: any) => void;
      onUpdate?: (update: any) => void;
      theme?: string;
      extensions?: unknown;
    }
  >((props, ref) => {
    const [localValue, setLocalValue] = React.useState(props.value ?? "");
    const onCreateEditorRef = React.useRef(props.onCreateEditor);
    onCreateEditorRef.current = props.onCreateEditor;
    const viewRef = React.useRef<any>({
      state: {
        doc: createDoc(props.value ?? ""),
        selection: { main: { head: 0 } },
        field: () => null,
      },
      dispatch: mockCodeMirrorDispatch.mockImplementation((transaction: any) => {
        const anchor = transaction?.selection?.anchor;
        if (typeof anchor === "number") {
          viewRef.current.state.selection.main.head = anchor;
        }
      }),
      focus: vi.fn(),
      posAtCoords: vi.fn(() => 0),
    });

    React.useEffect(() => {
      setLocalValue(props.value ?? "");
      viewRef.current.state.doc = createDoc(props.value ?? "");
      viewRef.current.state.field = () => null;
    }, [props.value]);

    React.useEffect(() => {
      mockCodeMirrorExtensionsSnapshots.push(props.extensions);
      mockCodeMirrorExtensionTokenSnapshots.push(extractMockExtensionTokens(props.extensions));
    }, [props.extensions]);

    React.useEffect(() => {
      onCreateEditorRef.current?.(viewRef.current, viewRef.current.state);
    }, []);

    React.useImperativeHandle(ref, () => ({ view: viewRef.current }), []);

    return (
      <textarea
        data-testid="mock-codemirror"
        data-editor-theme={props.theme ?? ""}
        value={localValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setLocalValue(nextValue);
          viewRef.current.state.doc = createDoc(nextValue);
          props.onChange?.(nextValue);
        }}
        onSelect={(event) => {
          const target = event.currentTarget;
          viewRef.current.state.selection.main = {
            from: target.selectionStart,
            to: target.selectionEnd,
            head: target.selectionEnd,
          };
          props.onUpdate?.({
            selectionSet: true,
            state: viewRef.current.state,
          });
        }}
      />
    );
  });

  return {
    __esModule: true,
    default: MockCodeMirror,
  };
});

function extractMockExtensionTokens(value: unknown): string[] {
  const tokens: string[] = [];
  const seen = new Set<unknown>();
  const visit = (candidate: unknown) => {
    if (candidate == null || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    if (typeof candidate === "string") {
      tokens.push(candidate);
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (typeof candidate === "object" && "extension" in candidate) {
      visit((candidate as { extension?: unknown }).extension);
    }
  };
  visit(value);
  return tokens;
}

vi.mock("../../app/components/OpenAppMenu", () => ({
  OpenAppMenu: () => <div data-testid="open-app-menu" />,
}));

vi.mock("./FilePdfPreview", () => ({
  FilePdfPreview: () => <div data-testid="pdf-preview" />,
}));

vi.mock("./FileTabularPreview", () => ({
  FileTabularPreview: () => <div data-testid="tabular-preview" />,
}));

vi.mock("./FileDocumentPreview", () => ({
  FileDocumentPreview: () => <div data-testid="document-preview" />,
}));

vi.mock("../hooks/useFilePreviewPayload", () => ({
  useFilePreviewPayload: vi.fn((args: { enabled: boolean; renderProfile: { extension: string | null } }) => {
    if (!args.enabled) {
      return {
        payload: null,
        isLoading: false,
        error: null,
      };
    }
    const extension = args.renderProfile.extension;
    if (extension === "pdf") {
      return {
        payload: {
          kind: "file-handle",
          sourceKind: "file-handle",
          absolutePath: "/repo/docs/report.pdf",
          assetUrl: "asset://localhost/repo/docs/report.pdf",
          extension,
          byteLength: 4096,
        },
        isLoading: false,
        error: null,
      };
    }
    if (extension === "docx" || extension === "doc") {
      return {
        payload: extension === "doc"
          ? {
              kind: "unsupported",
              sourceKind: "file-handle",
              reason: "legacy-doc",
            }
          : {
              kind: "extracted-structure",
              sourceKind: "extracted-structure",
              absolutePath: "/repo/docs/report.docx",
              assetUrl: "asset://localhost/repo/docs/report.docx",
              extension,
              byteLength: 2048,
              html: "<p>Converted document</p>",
              warnings: [],
            },
        isLoading: false,
        error: null,
      };
    }
    return {
      payload: {
        kind: "inline-bytes",
        sourceKind: "inline-bytes",
        text: "name,value\nalpha,1",
        extension,
        byteLength: 18,
        truncated: false,
      },
      isLoading: false,
      error: null,
    };
  }),
}));

vi.mock("../../../components/FileIcon", () => ({
  default: () => <span data-testid="file-icon" />,
}));

vi.mock("../../../services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
  readWorkspaceFilePreview: vi.fn(async () => ({ content: "", truncated: false })),
  readExternalSpecFile: vi.fn(),
  readExternalAbsoluteFile: vi.fn(),
  readLocalImageDataUrl: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  writeExternalSpecFile: vi.fn(),
  getGitFileFullDiff: vi.fn(),
  getCodeIntelDefinition: vi.fn(),
  getCodeIntelReferences: vi.fn(),
}));

vi.mock("../detachedFileExplorer", () => {
  return {
    buildDetachedFileExplorerSession: (input: {
      workspaceId: string;
      workspacePath: string;
      workspaceName: string;
      gitRoot?: string | null;
      initialFilePath?: string | null;
      defaultSidebarCollapsed?: boolean;
    }) => ({
      workspaceId: input.workspaceId.trim(),
      workspacePath: input.workspacePath.trim(),
      workspaceName: input.workspaceName.trim(),
      gitRoot: input.gitRoot?.trim() || null,
      initialFilePath: input.initialFilePath?.trim() || null,
      defaultSidebarCollapsed: input.defaultSidebarCollapsed === true,
      updatedAt: 123,
    }),
    openNewDetachedFileExplorerWindow: mockOpenNewDetachedFileExplorerWindow,
  };
});

export const mermaidInitialize = vi.fn();
export const mermaidRender = vi.fn(async (_id: string, source: string) => ({
  svg: `<svg data-mermaid-source="${source.replace(/"/g, "&quot;")}"></svg>`,
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender,
  },
}));

export function buildLocation(path: string, line: number, character: number) {
  return {
    uri: `file:///repo/${path}`,
    path,
    range: {
      start: { line, character },
      end: { line, character: character + 1 },
    },
  };
}

export function buildWindowsLocation(path: string, line: number, character: number) {
  const normalizedPath = path.replace(/\\/g, "/");
  return {
    uri: `file:///C:/Repo/${normalizedPath}`,
    path: `C:\\Repo\\${path.replace(/\//g, "\\")}`,
    range: {
      start: { line, character },
      end: { line, character: character + 1 },
    },
  };
}
