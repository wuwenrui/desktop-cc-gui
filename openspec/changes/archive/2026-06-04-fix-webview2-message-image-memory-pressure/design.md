## Overview

This change fixes WebView2 renderer memory pressure caused by message images by separating canonical image data from transient render resources. The conversation state continues to own the original image references or deferred locators. The message rendering layer owns temporary full image resources only while they are actively needed for preview/lightbox operations.

## Goals

- Preserve image preview and original-image lightbox behavior.
- Prevent hydrated deferred images from staying permanently in row state.
- Avoid changing model send payloads or history loader canonical data.
- Make virtualization sensitive to image-heavy timelines.

## Design

### Image resource lifecycle

`MessageRow` will keep only transient full image state needed for the current lightbox operation. Deferred Claude images will hydrate when the user opens them, remain available while the preview is open, and be cleared when the preview closes or the row unmounts.

Inline message images keep their canonical `item.images` values unchanged. The render layer derives preview/lightbox resources from those values. If a resource is already a data URL, it remains available to the full-image preview only as a transient render input, not as a newly persisted state value.

### Weighted virtualization

`messagesTimelineVirtualization` will expose a weight resolver for timeline projection rows. The resolver counts image-bearing message rows, generated image cards, deferred image rows, and long text rows as heavier than ordinary rows. `shouldVirtualizeTimelineRows` will enable virtualization when either row count or accumulated render weight crosses a threshold.

### Error handling

If deferred image hydration fails, the existing recoverable error state remains user-visible. Cleanup must not remove the error or the deferred locator; it only clears loaded full image data.

## Options Considered

- Compress images in timeline: rejected because it changes visual fidelity and can be perceived as feature degradation.
- Backend thumbnail/cache API: deferred as a later improvement because it requires new Rust commands and cache policy.
- Frontend transient resource lifecycle: selected because it is local, rollback-safe, and preserves behavior.

## Validation Plan

- Focused unit tests for weighted virtualization thresholds.
- Focused message rendering tests for deferred image hydrate/open/close cleanup.
- Existing rich-content tests should continue to prove preview and lightbox availability.
