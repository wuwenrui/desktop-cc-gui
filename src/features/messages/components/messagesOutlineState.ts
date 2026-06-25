import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";

export type MessageOutlineSnapshot = {
  messageId: string;
  outline: MarkdownOutlineEntry[];
};

function areMarkdownOutlineEntriesEqual(
  previous: MarkdownOutlineEntry,
  next: MarkdownOutlineEntry,
) {
  return (
    previous.id === next.id &&
    previous.anchor === next.anchor &&
    previous.title === next.title &&
    previous.depth === next.depth &&
    previous.startLine === next.startLine &&
    previous.endLine === next.endLine &&
    previous.ordinal === next.ordinal
  );
}

export function areMarkdownOutlinesEqual(
  previous: MarkdownOutlineEntry[],
  next: MarkdownOutlineEntry[],
) {
  if (previous === next) {
    return true;
  }
  if (previous.length !== next.length) {
    return false;
  }
  return previous.every((entry, index) => {
    const nextEntry = next[index];
    return nextEntry ? areMarkdownOutlineEntriesEqual(entry, nextEntry) : false;
  });
}

export function resolveNextMessageOutlineSnapshot(
  previous: MessageOutlineSnapshot | null,
  next: MessageOutlineSnapshot,
): MessageOutlineSnapshot {
  if (
    previous &&
    previous.messageId === next.messageId &&
    areMarkdownOutlinesEqual(previous.outline, next.outline)
  ) {
    return previous;
  }
  return next;
}
