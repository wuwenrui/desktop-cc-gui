## ADDED Requirements

### Requirement: Files view uses low-signal filtering instead of unconditional governance hiding
The Project Map Files view SHALL treat low-signal files as a UI projection concern and MUST NOT hide governance or documentation roots solely because their path starts with `openspec/`, `.trellis/`, or `docs/`.

#### Scenario: Governance source appears in a relationship snapshot
- **WHEN** a scanned file belongs to `openspec/`, `.trellis/`, or `docs/` and has a meaningful role or parse status
- **THEN** the Files view can include it by default instead of classifying it as unconditional noise.

#### Scenario: Low-signal files are hidden by default
- **WHEN** a scanned file is skipped, unknown, style-only, or infrastructure-only
- **THEN** the Files view may hide it until the user enables low-signal files.

### Requirement: Java relationship calls prefer verified receiver resolution
The Project Map relationship scanner SHALL avoid treating broad Java call text matches as verified cross-file `calls` relationships.

#### Scenario: Java code calls an imported or injected collaborator
- **WHEN** a Java file calls `receiver.method(...)` or `Type.method(...)`
- **AND** the receiver/type can be resolved from imports, the current class, or a declared field
- **AND** the target file declares the called method
- **THEN** the scanner may emit a `calls` relationship from the source file to the target file.

#### Scenario: Java code contains an untyped local or generic call candidate
- **WHEN** a Java call candidate is an annotation/constructor-like token, local variable getter, DTO getter, enum equality helper, or otherwise lacks a resolvable receiver/type
- **THEN** the scanner SHALL NOT emit it as a verified cross-file `calls` relationship in the main relationship graph.

### Requirement: Relationship workspace avoids persistent repair strip noise
The Project Map relationship workspace SHALL NOT render repair/read-error artifacts as a persistent bottom strip across Graph, Files, Read, or API tabs.

#### Scenario: Snapshot contains repair issues or read errors
- **WHEN** the user switches between relationship tabs
- **THEN** repair/read-error artifacts do not appear as a global bottom text/chip strip
- **AND** the underlying artifacts remain available for future explicit diagnostics surfaces.
