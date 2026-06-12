# Lawhub OCR Vision Workflow Design

## Goal

Add OCR under the left `lawhub` menu. OCR uses a separate vision-capable model from the user's available model list, saves recognized text under the workspace, and inserts the saved OCR result into the current Composer. It must not change the user's main conversation model.

## Architecture

```text
lawhub menu
  -> OCR panel
    -> file picker: image/pdf
    -> vision model resolver
    -> PDF/image batch normalizer
    -> engineSendMessageSync(engine, model, images, continueSession=false)
    -> writeWorkspaceFile(lawhub-ocr/<source>/<run>-ocr.md)
    -> composer insert event
```

## Model Rule

Do not use the active main model just because it is selected in Composer. OCR has its own model selector.

The candidate resolver uses:

1. Explicit model capability: `capabilities.imageInput`.
2. User-saved OCR vision model binding.
3. Conservative known-model hints.
4. Engine-level `imageInput` only as unknown/manual, never auto-select.

This prevents ds/DeepSeek text models from receiving images while preserving the user's main model for normal conversation.

## Output Rule

Every successful run writes:

```text
lawhub-ocr/<source-stem>/<YYYYMMDD-HHmmss>-ocr.md
```

Then the same result is inserted into Composer with:

- saved file path;
- source file name;
- OCR model used;
- OCR Markdown text.

If save fails, Composer insertion is skipped.

## Components

### `lawhub-ocr` feature slice

- `LawhubOcrPanel`: file selection, model selection, progress, result preview.
- `visionModelResolver`: produces supported/unknown/unsupported OCR candidates from user model list.
- `ocrRunner`: calls `engineSendMessageSync` with an isolated auto session.
- `ocrMarkdown`: builds deterministic Markdown result.
- `ocrComposerBridge`: dispatches saved OCR result to Composer.

### `LawhubNavSection`

Adds `OCR 识别` under `lawhub`, alongside `制作 PPT`.

### Composer listener

Listens for OCR insert events and inserts text into the existing draft without changing engine/model/session selection.

## Data Flow

1. User opens `lawhub -> OCR 识别`.
2. User selects PDF/image files.
3. UI recommends a confirmed vision model, or asks user to choose one.
4. PDF pages render to images with page/batch limits.
5. OCR runner calls the selected vision model with image batches.
6. Markdown result is saved under `lawhub-ocr/...`.
7. Composer receives saved path and OCR text for the active main model to use as plain text.

## Success Criteria

- OCR menu appears under `lawhub`.
- Running OCR never changes the main model.
- OCR rejects auto-selection of unknown/ds-style text models.
- PDF/image OCR result is saved under `lawhub-ocr/...`.
- Composer receives the saved OCR text after save succeeds.
- Unit and component tests cover model resolver, runner parameters, output path, and Composer insertion.
