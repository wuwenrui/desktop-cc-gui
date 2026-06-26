# Design: fast Markdown annotation action overlay

## Approach

The fast Markdown renderer already renders annotation markers and drafts through an absolute overlay layer keyed by parser-produced source-line anchors. This change extends that overlay model so the action button uses the same line-anchor positioning contract instead of being imperatively inserted after sanitized DOM blocks.

## Data Flow

1. Fast compile emits `sourceLineAnchors`.
2. `FileMarkdownFastPreview` builds a map from `data-source-block-id` to mounted sanitized block elements.
3. Overlay item derivation creates one item per block that needs either:
   - an annotation action button,
   - existing annotation markers,
   - an annotation draft.
4. Clicking the action button calls `onAnnotationStart({ startLine, endLine })`.

## Why Not CSS-Only

A CSS-only fix would make the existing button more visible but would not repair the broken structure contract: the button is not inside `.fvp-markdown-annotatable-block`, and absolute positioning has no per-block wrapper anchor. Rendering the action in the existing fast overlay is the smaller durable fix.

## Testing

Add a focused regression covering a fast-rendered Markdown preview with `onCreateCodeAnnotation`, asserting the visible action can open the annotation draft and submit the expected file-preview annotation.
