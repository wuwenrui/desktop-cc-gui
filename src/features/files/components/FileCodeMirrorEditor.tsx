import { Suspense, lazy, useCallback, useRef, type MutableRefObject } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { FileCodeMirrorEditorProps } from "./FileCodeMirrorEditorImpl";

export type FileCodeMirrorEditorHandle = ReactCodeMirrorRef & {
  openFindPanel: () => boolean;
  toggleFindPanel: () => boolean;
  flashNavigationLine: (line: number) => boolean;
  clearNavigationFlash: () => void;
};

const FileCodeMirrorEditorImpl = lazy(async () => {
  const module = await import("./FileCodeMirrorEditorImpl");
  return { default: module.FileCodeMirrorEditorImpl };
});

export type { FileCodeMirrorEditorProps };

// Public surface used by `FileViewBody`. The lazy boundary keeps
// `@uiw/react-codemirror` and the inner editor logic out of the
// file panel shell's startup path. The shell still owns
// `cmRef`; we forward it to the inner editor via a callback ref so
// callers can keep using `cmRef.current?.view` after the chunk
// resolves.
export function FileCodeMirrorEditor(
  props: FileCodeMirrorEditorProps & {
    cmRef: MutableRefObject<FileCodeMirrorEditorHandle | null>;
    fallback: React.ReactNode;
  },
) {
  const { cmRef, fallback, ...rest } = props;
  const localRef = useRef<FileCodeMirrorEditorHandle | null>(null);
  const setRef = useCallback(
    (node: FileCodeMirrorEditorHandle | null) => {
      localRef.current = node;
      cmRef.current = node;
    },
    [cmRef],
  );
  return (
    <Suspense fallback={fallback}>
      <FileCodeMirrorEditorImpl ref={setRef} {...rest} />
    </Suspense>
  );
}
