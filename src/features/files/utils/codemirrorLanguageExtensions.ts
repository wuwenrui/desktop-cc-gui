import { type Extension } from "@codemirror/state";
import type { StreamParser } from "@codemirror/language";
import {
  resolveEditorLanguageFromPath,
  type EditorLanguageId,
} from "../../../utils/fileLanguageRegistry";

const editorExtensionCache = new Map<EditorLanguageId, Promise<Extension[]>>();

async function loadStreamLanguageExtension(
  modeLoader: () => Promise<unknown>,
  modeName: string,
  modeFactory?: (mode: unknown) => unknown,
): Promise<Extension[]> {
  const [{ StreamLanguage }, modeModule] = await Promise.all([
    import("@codemirror/language"),
    modeLoader(),
  ]);
  const mode = (modeModule as Record<string, unknown>)[modeName];
  return [StreamLanguage.define((modeFactory ? modeFactory(mode) : mode) as StreamParser<unknown>)];
}

function loadEditorLanguageExtensions(editorLanguage: EditorLanguageId): Promise<Extension[]> {
  switch (editorLanguage) {
    case "javascript":
      return import("@codemirror/lang-javascript").then(({ javascript }) => [javascript()]);
    case "javascript-jsx":
      return import("@codemirror/lang-javascript").then(({ javascript }) => [javascript({ jsx: true })]);
    case "typescript":
      return import("@codemirror/lang-javascript").then(({ javascript }) => [javascript({ typescript: true })]);
    case "typescript-jsx":
      return import("@codemirror/lang-javascript").then(({ javascript }) => [javascript({ jsx: true, typescript: true })]);
    case "json":
      return import("@codemirror/lang-json").then(({ json }) => [json()]);
    case "html":
      return import("@codemirror/lang-html").then(({ html }) => [html()]);
    case "css":
      return import("@codemirror/lang-css").then(({ css }) => [css()]);
    case "markdown":
      return import("@codemirror/lang-markdown").then(({ markdown }) => [markdown()]);
    case "python":
      return import("@codemirror/lang-python").then(({ python }) => [python()]);
    case "rust":
      return import("@codemirror/lang-rust").then(({ rust }) => [rust()]);
    case "xml":
      return import("@codemirror/lang-xml").then(({ xml }) => [xml()]);
    case "yaml":
      return import("@codemirror/lang-yaml").then(({ yaml }) => [yaml()]);
    case "java":
      return import("@codemirror/lang-java").then(({ java }) => [java()]);
    case "groovy":
      return loadStreamLanguageExtension(() => import("@codemirror/legacy-modes/mode/groovy"), "groovy");
    case "kotlin":
      return loadStreamLanguageExtension(() => import("@codemirror/legacy-modes/mode/clike"), "kotlin");
    case "properties":
      return loadStreamLanguageExtension(() => import("@codemirror/legacy-modes/mode/properties"), "properties");
    case "sql":
      return loadStreamLanguageExtension(
        () => import("@codemirror/legacy-modes/mode/sql"),
        "sql",
        (mode) => (mode as (config: Record<string, never>) => unknown)({}),
      );
    case "toml":
      return loadStreamLanguageExtension(() => import("@codemirror/legacy-modes/mode/toml"), "toml");
    case "shell":
      return loadStreamLanguageExtension(() => import("@codemirror/legacy-modes/mode/shell"), "shell");
    default:
      return Promise.resolve([]);
  }
}

export function loadCodeMirrorExtensionsForEditorLanguage(
  editorLanguage: EditorLanguageId | null | undefined,
): Promise<Extension[]> {
  if (!editorLanguage) {
    return Promise.resolve([]);
  }
  const cached = editorExtensionCache.get(editorLanguage);
  if (cached) {
    return cached;
  }
  const loaded = loadEditorLanguageExtensions(editorLanguage).catch((error) => {
    editorExtensionCache.delete(editorLanguage);
    throw error;
  });
  editorExtensionCache.set(editorLanguage, loaded);
  return loaded;
}

export function loadCodeMirrorExtensionsForPath(filePath: string): Promise<Extension[]> {
  const editorLanguage = resolveEditorLanguageFromPath(filePath);
  return loadCodeMirrorExtensionsForEditorLanguage(editorLanguage);
}
