# lawhub-ocr-vision-workflow

lawhub OCR 工作流 SHALL allow users to OCR image/PDF case material with a vision-capable model without changing the main conversation model.

## Requirement: OCR entry lives under lawhub menu

The desktop client SHALL expose an `OCR 识别` action under the left sidebar `lawhub` menu.

### Scenario: user opens OCR from lawhub

- WHEN the user expands `lawhub`
- THEN the menu SHALL include `OCR 识别`
- AND activating it SHALL open the OCR panel without sending a chat message.

## Requirement: OCR MUST NOT change main conversation model

OCR execution SHALL run as an isolated vision subtask and MUST NOT mutate the active conversation's engine, provider, model, effort, session id, or thread composer selection.

### Scenario: main model remains unchanged

- GIVEN the active conversation uses a text-only model
- WHEN the user runs OCR with a separate vision model
- THEN the selected main conversation model SHALL remain unchanged
- AND the next normal user message SHALL still use the original main model unless the user explicitly changes it.

## Requirement: OCR model selection uses model-level vision capability

The OCR panel SHALL select OCR candidates from user-available models with model-level vision capability. Engine-level image support MAY be used as a coarse prefilter but MUST NOT be treated as proof that every model in that engine supports vision.

### Scenario: supported vision model is available

- GIVEN at least one user-available model has confirmed image input capability
- WHEN the OCR panel opens
- THEN it SHALL recommend a confirmed vision model for OCR.

### Scenario: only unknown image-capable engine models exist

- GIVEN an engine supports image input but the selected model has no model-level vision evidence
- WHEN the OCR panel builds candidates
- THEN it SHALL mark that model as unknown
- AND it SHALL NOT auto-select the unknown model.

### Scenario: text-only model is active

- GIVEN the main conversation uses a text-only model such as a DeepSeek/ds model
- WHEN the user runs OCR
- THEN the OCR workflow SHALL select or ask for a separate vision model
- AND it SHALL NOT pass image/PDF content to the active text-only model.

## Requirement: OCR output has two destinations

OCR output SHALL be written to the active workspace and inserted into the current Composer input/context after the file save succeeds.

### Scenario: save and insert result

- WHEN OCR completes for `evidence.pdf`
- THEN the client SHALL write a Markdown result under `lawhub-ocr/evidence/<run-id>-ocr.md`
- AND it SHALL insert a Composer payload containing the saved path and OCR text.

### Scenario: save failure prevents insertion

- WHEN OCR text is produced but workspace save fails
- THEN the client SHALL show an error
- AND it SHALL NOT insert a payload that claims the result was saved.

## Requirement: PDF input is rendered and processed in bounded batches

PDF OCR SHALL render pages to images before model submission and process pages in bounded batches.

### Scenario: bounded PDF OCR

- WHEN a PDF has more pages than the configured OCR page limit
- THEN the OCR panel SHALL process only the selected page range or configured limit
- AND it SHALL explain which pages remain unprocessed.

### Scenario: partial failures are retained

- WHEN OCR succeeds for some pages and fails for others
- THEN the saved Markdown SHALL include successful pages and failed page markers
- AND the UI SHALL allow retrying failed pages.
