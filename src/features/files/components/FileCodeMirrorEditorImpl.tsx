import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import CodeMirror, {
  type ReactCodeMirrorProps,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { Decoration, EditorView, keymap, type DecorationSet } from "@codemirror/view";
import { closeSearchPanel, openSearchPanel, search, searchPanelOpen } from "@codemirror/search";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import type { CodeAnnotationSelection } from "../../code-annotations/types";
import type { GitLineMarkers } from "../utils/gitLineMarkers";
import {
  codeAnnotationWidgetsExtension,
  gitLineMarkersExtension,
  setGitLineMarkersEffect,
} from "./fileViewPanelInternals";
import type {
  AnnotationWidgetCallbacks,
  FileAnnotationDraftState,
} from "./fileViewPanelShared";
import { toCodeMirrorShortcut } from "./fileViewPanelShared";
import type { FileCodeMirrorEditorHandle } from "./FileCodeMirrorEditor";

export type FileCodeMirrorEditorProps = {
  filePath: string;
  value: string;
  onChange: (value: string) => void;
  onActiveFileLineRangeChange?: (range: { startLine: number; endLine: number } | null) => void;
  theme: ReactCodeMirrorProps["theme"];
  languageExtensions: ReactCodeMirrorProps["extensions"];
  gitLineMarkers: GitLineMarkers;
  codeAnnotations: CodeAnnotationSelection[];
  annotationDraft: FileAnnotationDraftState | null;
  annotationWidgetLabels: {
    title: string;
    remove: string;
    placeholder: string;
    cancel: string;
    submit: string;
  };
  annotationWidgetCallbacks: AnnotationWidgetCallbacks;
  runDefinitionFromCursor: () => void;
  runReferencesFromCursor: () => void;
  resolveDefinitionAtOffset: (offset: number, view?: EditorView) => void | Promise<void>;
  className?: string;
  lastReportedLineRangeRef: { current: string };
  saveFileShortcut: string | null | undefined;
  handleSave: () => void;
};

const navigationLineFlashEffect = StateEffect.define<number | null>();

const navigationLineFlashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(markers, transaction) {
    let nextMarkers = markers.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(navigationLineFlashEffect)) {
        continue;
      }
      const lineNumber = effect.value;
      if (lineNumber === null) {
        nextMarkers = Decoration.none;
        continue;
      }
      if (lineNumber < 1 || lineNumber > transaction.state.doc.lines) {
        nextMarkers = Decoration.none;
        continue;
      }
      const line = transaction.state.doc.line(lineNumber);
      nextMarkers = Decoration.set([
        Decoration.line({ class: "cm-navigation-line-flash" }).range(line.from),
      ]);
    }
    return nextMarkers;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const FileCodeMirrorEditorImpl = forwardRef<
  FileCodeMirrorEditorHandle,
  FileCodeMirrorEditorProps
>(function FileCodeMirrorEditorImpl(props, ref) {
  const {
    filePath,
    value,
    onChange,
    onActiveFileLineRangeChange,
    theme,
    languageExtensions,
    gitLineMarkers,
    codeAnnotations,
    annotationDraft,
    annotationWidgetLabels,
    annotationWidgetCallbacks,
    runDefinitionFromCursor,
    runReferencesFromCursor,
    resolveDefinitionAtOffset,
    className,
    lastReportedLineRangeRef,
    saveFileShortcut,
    handleSave,
  } = props;
  const codeMirrorRef = useRef<ReactCodeMirrorRef | null>(null);

  // Keep a ref to the latest `handleSave` so the keymap (memoized on
  // shortcut) always invokes the most recent callback.
  const handleSaveRef = useRef<() => void>(handleSave);
  handleSaveRef.current = handleSave;
  const saveKeymapExt = useMemo<Extension[]>(() => {
    const codeMirrorSaveShortcut = toCodeMirrorShortcut(saveFileShortcut);
    if (!codeMirrorSaveShortcut) {
      return [];
    }
    const ext = keymap.of([
      {
        key: codeMirrorSaveShortcut,
        run: () => {
          handleSaveRef.current();
          return true;
        },
      },
    ]);
    return [ext];
  }, [saveFileShortcut]);

  const editorNavigationKeymapExt = useMemo<Extension[]>(
    () => [
      navigationLineFlashField,
      keymap.of([
        {
          key: "Mod-f",
          run: (view) => {
            if (searchPanelOpen(view.state)) {
              closeSearchPanel(view);
            } else {
              openSearchPanel(view);
            }
            view.focus();
            return true;
          },
        },
        {
          key: "Mod-b",
          run: () => {
            runDefinitionFromCursor();
            return true;
          },
        },
        {
          key: "Alt-F7",
          run: () => {
            runReferencesFromCursor();
            return true;
          },
        },
      ]),
    ],
    [runDefinitionFromCursor, runReferencesFromCursor],
  );

  const ctrlClickDefinitionExt = useMemo(
    () =>
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          if (event.button !== 0) {
            return false;
          }
          if (!(event.metaKey || event.ctrlKey)) {
            return false;
          }
          const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (offset == null) {
            return false;
          }
          event.preventDefault();
          void resolveDefinitionAtOffset(offset, view);
          return true;
        },
      }),
    [resolveDefinitionAtOffset],
  );

  const persistentSearchExtension = useMemo(() => search({ top: true }), []);
  const annotationWidgetsExt = useMemo(
    () =>
      codeAnnotationWidgetsExtension({
        annotations: codeAnnotations,
        draft: annotationDraft,
        labels: annotationWidgetLabels,
        callbacks: annotationWidgetCallbacks,
      }),
    [
      annotationDraft,
      annotationWidgetCallbacks,
      annotationWidgetLabels,
      codeAnnotations,
    ],
  );

  const composedExtensions: ReactCodeMirrorProps["extensions"] = useMemo(
    () => [
      saveKeymapExt,
      editorNavigationKeymapExt,
      ctrlClickDefinitionExt,
      persistentSearchExtension,
      annotationWidgetsExt,
      gitLineMarkersExtension(),
      ...(Array.isArray(languageExtensions)
        ? languageExtensions
        : languageExtensions
          ? [languageExtensions]
          : []),
    ],
    [
      annotationWidgetsExt,
      ctrlClickDefinitionExt,
      editorNavigationKeymapExt,
      languageExtensions,
      persistentSearchExtension,
      saveKeymapExt,
    ],
  );

  const clearNavigationFlash = () => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: navigationLineFlashEffect.of(null),
    });
  };

  useImperativeHandle(ref, () => ({
    get view() {
      return codeMirrorRef.current?.view;
    },
    get state() {
      return codeMirrorRef.current?.state;
    },
    openFindPanel() {
      const view = codeMirrorRef.current?.view;
      if (!view) {
        return false;
      }
      openSearchPanel(view);
      view.focus();
      return true;
    },
    toggleFindPanel() {
      const view = codeMirrorRef.current?.view;
      if (!view) {
        return false;
      }
      if (searchPanelOpen(view.state)) {
        closeSearchPanel(view);
      } else {
        openSearchPanel(view);
      }
      view.focus();
      return true;
    },
    flashNavigationLine(line) {
      const view = codeMirrorRef.current?.view;
      if (!view || line < 1 || line > view.state.doc.lines) {
        return false;
      }
      view.dispatch({
        effects: navigationLineFlashEffect.of(line),
      });
      return true;
    },
    clearNavigationFlash,
  }), []);

  useEffect(() => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: setGitLineMarkersEffect.of(gitLineMarkers),
    });
  }, [gitLineMarkers, filePath]);

  return (
    <div className="fvp-editor">
      <CodeMirror
        key={filePath}
        ref={codeMirrorRef}
        value={value}
        onChange={onChange}
        onCreateEditor={(view) => {
          view.dispatch({
            effects: setGitLineMarkersEffect.of(gitLineMarkers),
          });
        }}
        onUpdate={(update) => {
          if (!update.selectionSet) {
            return;
          }
          const mainSelection = update.state.selection.main;
          const from = Math.min(mainSelection.from, mainSelection.to);
          const to = Math.max(mainSelection.from, mainSelection.to);
          const startLine = update.state.doc.lineAt(from).number;
          const endLine = update.state.doc.lineAt(to).number;
          const rangeKey = `${startLine}-${endLine}`;
          if (rangeKey === lastReportedLineRangeRef.current) {
            return;
          }
          lastReportedLineRangeRef.current = rangeKey;
          onActiveFileLineRangeChange?.({ startLine, endLine });
        }}
        extensions={composedExtensions}
        theme={theme}
        className={className ?? "fvp-cm"}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          indentOnInput: true,
          tabSize: 2,
        }}
      />
    </div>
  );
});
