## ADDED Requirements

### Requirement: AppShell Boundary Closeout MUST Separate Domain Extraction From Physical Modularization
AppShell runtime-boundary closeout MUST distinguish domain context extraction and structured input boundaries from complete physical file modularization.

#### Scenario: domain extraction is complete but adapter remains
- **WHEN** AppShell has been split into domain context objects and section hooks receive structured inputs
- **AND** rendering still uses a flat compatibility adapter or a large physical file remains above the modularization threshold
- **THEN** the change MAY claim domain-boundary completion
- **AND** it MUST keep physical modularization as explicit follow-up debt rather than claiming full module split completion

#### Scenario: large shell files remain after performance fix
- **WHEN** files such as `app-shell.tsx`, `useAppServerEvents.ts`, `useLayoutNodes.tsx`, `MessagesRows.tsx`, `Markdown.tsx`, or `FileViewPanel.tsx` remain large after a performance-focused change
- **THEN** the closeout notes MUST classify them as structural modularization debt if they are not part of the current implementation scope
- **AND** archive readiness MUST NOT depend on reducing those files unless the active change explicitly set that as an acceptance criterion
