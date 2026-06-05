## ADDED Requirements

### Requirement: Project Map graph SHALL remain the primary surface

Project Map SHALL keep the structure graph as the primary visual surface while query, recent activity, association explanation, and evidence navigation are presented as lightweight overlays or collapsible panels.

#### Scenario: Project Map opens to the graph

- **WHEN** the user opens Project Map for a workspace with persisted map data
- **THEN** the graph SHALL remain the primary visible surface
- **AND** newly added query, recent activity, association explanation, and evidence navigation surfaces SHALL NOT replace the graph as the default view

#### Scenario: Auxiliary surfaces are collapsible

- **WHEN** query results, recent activity, association explanation, evidence navigation, or quick filters are available
- **THEN** Project Map SHALL expose them through compact controls, overlays, or collapsible sections
- **AND** the user SHALL be able to collapse or clear those surfaces without mutating Project Map data

### Requirement: Project Map SHALL provide unified project query

Project Map SHALL provide a unified query surface that can search Project Map nodes, evidence files, relations, governance links, stale reasons, and recent activity while preserving graph focus.

#### Scenario: Query matches nodes

- **WHEN** a query matches a node title, summary, node kind, lens, source path, related artifact, or detail text
- **THEN** Project Map SHALL show matching node results with enough matched-field context to explain why they matched
- **AND** selecting a node result SHALL focus or select that node on the graph
- **AND** matching nodes SHALL be highlighted without changing graph layout

#### Scenario: Query matches non-node context

- **WHEN** a query matches an evidence file, relation, spec link, task link, stale reason, or recent activity item
- **THEN** Project Map SHALL show that result in a grouped non-node result section
- **AND** the result SHALL link to relevant nodes or relations when available
- **AND** unmapped results SHALL be shown as degraded or non-node context rather than being silently ignored

#### Scenario: Query searches only dataset-backed artifact references

- **WHEN** Project Map searches spec, task, governance, or artifact context
- **THEN** it SHALL only search references already present in Project Map dataset fields such as node sources, related artifacts, relation evidence, evidence records, or run metadata
- **AND** it SHALL NOT require hard-coded OpenSpec, Trellis, Codex, Claude, or user-local path conventions to produce those query results

### Requirement: Project Map SHALL provide recent activity overlay

Project Map SHALL provide a collapsible recent activity overlay that projects recent workspace activity onto Project Map nodes, files, relations, and risk summaries.

#### Scenario: Recent file changes map to graph nodes

- **WHEN** recent changed files are available from git status or explicit Project Map impact input
- **THEN** Project Map SHALL identify directly changed nodes, affected nodes, affected lenses, unmapped files, and risk summary
- **AND** directly changed and affected nodes SHALL be visually distinguishable on the graph

#### Scenario: Changed-file input is unavailable

- **WHEN** Project Map does not have changed-file or impact input available through the current frontend contract
- **THEN** Project Map SHALL show an honest empty or degraded changed-file activity state
- **AND** it MAY still summarize map-derived activity from runs, stale nodes, candidates, and evidence records
- **AND** it SHALL NOT present map-derived activity as a live git or complete chronological feed

#### Scenario: Recent activity includes map state

- **WHEN** the dataset contains stale nodes, candidate nodes, pending review candidates, or recent Project Map runs
- **THEN** Project Map SHALL be able to summarize those items in recent activity
- **AND** activity items that map to nodes SHALL allow the user to focus those nodes
- **AND** the activity UI SHALL distinguish changed-file input from map-derived run, stale, candidate, and evidence state

#### Scenario: Unmapped activity remains visible

- **WHEN** a recent activity item or changed file cannot be mapped to a Project Map node
- **THEN** Project Map SHALL show it as unmapped or degraded context
- **AND** Project Map SHALL NOT create fake graph nodes for that unmapped context

### Requirement: Project Map SHALL provide quick graph filter chips

Project Map SHALL provide lightweight filter chips for high-signal graph states without replacing the current graph view.

#### Scenario: User filters high-signal states

- **WHEN** the user activates a quick filter such as Changed, Affected, Stale, Candidate, Low Confidence, or Inferred Relations
- **THEN** Project Map SHALL highlight matching nodes or relations on the existing graph
- **AND** the filter SHALL be clearable
- **AND** activating the filter SHALL NOT mutate semantic map data or reset saved node layout

#### Scenario: Multiple graph overlays are active

- **WHEN** selected node, selected relation, path result, search result, recent activity, quick filter, and base graph state overlap on the same graph item
- **THEN** Project Map SHALL render highlight priority deterministically as selected state, path state, search state, recent activity state, quick filter state, then base graph state
- **AND** each overlay SHALL be clearable independently
- **AND** clearing one overlay SHALL NOT reset saved graph layout or mutate Project Map semantic data

### Requirement: Project Map SHALL explain selected-node associations

Project Map SHALL expose association context for a selected node through collapsible detail sections.

#### Scenario: Selected node has relation context

- **WHEN** the selected node has incoming or outgoing relations
- **THEN** Project Map SHALL show relation type, source kind, direction, confidence, stale state, and evidence count
- **AND** activating a related node SHALL focus that node on the graph

#### Scenario: Selected node has inferred or low-confidence relation

- **WHEN** a selected node relation is AI-inferred, low-confidence, unknown-confidence, or stale
- **THEN** Project Map SHALL visibly mark the relation state
- **AND** Project Map SHALL NOT present that relation as deterministic verified truth

#### Scenario: Selected node has recent activity

- **WHEN** recent activity maps to the selected node
- **THEN** Project Map SHALL show that activity in the selected-node detail context
- **AND** the section SHALL be collapsible or compact by default

### Requirement: Project Map SHALL explain paths between nodes

Project Map SHALL extend path finding with an evidence-aware explanation of why two nodes are related.

#### Scenario: Path exists between selected nodes

- **WHEN** the user selects a source and target node with a discoverable hierarchy or relation path
- **THEN** Project Map SHALL show the ordered path
- **AND** Project Map SHALL highlight path nodes and path edges on the graph
- **AND** Project Map SHALL explain each step using relation metadata or hierarchy fallback context

#### Scenario: Path step has relation metadata

- **WHEN** a path step uses a typed relation
- **THEN** the explanation SHALL include relation type, source kind, confidence, stale state, and evidence count
- **AND** inferred or low-confidence relation steps SHALL be clearly labeled

#### Scenario: No path exists between selected nodes

- **WHEN** no path exists between the selected source and target nodes
- **THEN** Project Map SHALL show a clear no-path result
- **AND** the graph SHALL remain usable

### Requirement: Project Map SHALL enhance evidence-file navigation

Project Map SHALL enhance evidence-file navigation so file-backed evidence can be used to reverse lookup related nodes, relations, recent changes, and editor targets.

#### Scenario: Evidence file maps to nodes and relations

- **WHEN** a file is referenced by node sources, related artifacts, relations, or governance links
- **THEN** Project Map SHALL show related nodes, related relations, evidence counts, stale count, and low-confidence count for that file
- **AND** selecting a related node SHALL focus or select it in the graph when it still exists

#### Scenario: Evidence file is recently changed

- **WHEN** an evidence file is included in recent changed files or impact input
- **THEN** Project Map SHALL mark the file as recently changed or impact-relevant
- **AND** the file detail SHALL distinguish mapped and unmapped impact when possible

#### Scenario: User opens evidence file

- **WHEN** the user activates a concrete workspace file reference
- **THEN** Project Map SHALL route the request through the existing evidence file open path
- **AND** available one-based line references SHALL be preserved

### Requirement: Project Map SHALL provide local advisor hints inspired by Understand-Anything

Project Map SHALL borrow useful Understand-Anything agent and skill logic as local Project Map advisor projections without requiring the Understand-Anything plugin, graph schema, dashboard, or `.understand-anything` files at runtime.

#### Scenario: Advisor hints are derived locally

- **WHEN** Project Map produces diff-impact, query-neighborhood, node-explain, guide-topology, or graph-health hints
- **THEN** those hints SHALL be derived from `ProjectMapDataset`, Project Map relations, evidence indexes, impact analysis, graph integrity data, and current UI inputs
- **AND** Project Map SHALL NOT shell out to Understand-Anything skills or agents
- **AND** Project Map SHALL NOT require a `.understand-anything/knowledge-graph.json` file

#### Scenario: Diff-impact advisor explains recent changes

- **WHEN** changed-file or impact input is available
- **THEN** Project Map SHALL be able to summarize changed nodes, affected nodes, affected lenses, impacted relations, unmapped files, and risk hints
- **AND** advisor output SHALL be focusable on the graph when mapped nodes or relations exist

#### Scenario: Query-neighborhood advisor explains search context

- **WHEN** a user query matches Project Map nodes or non-node context
- **THEN** Project Map SHALL be able to show bounded one-hop neighborhood hints around the matched context
- **AND** the hints SHALL include relevant nodes, relations, lenses, artifacts, or degraded references when available
- **AND** the hints SHALL respect result caps and large-file safeguards

#### Scenario: Node-explain advisor summarizes selected node context

- **WHEN** a node is selected
- **THEN** Project Map SHALL be able to summarize children, incoming/outgoing relations, evidence, recent activity, stale/candidate state, and risk flags from existing Project Map data
- **AND** the summary SHALL distinguish deterministic evidence from inferred, degraded, or review-needed context

#### Scenario: Guide-topology advisor suggests next inspection targets

- **WHEN** Project Map has enough graph topology to infer useful next steps
- **THEN** Project Map SHALL be able to suggest next nodes or walkthrough hints using signals such as entry candidates, fan-in, fan-out, path traversal, clusters, or existing tour steps
- **AND** suggestions SHALL focus the existing graph rather than opening a separate dashboard

#### Scenario: Graph-health advisor surfaces review warnings

- **WHEN** Project Map detects graph integrity issues, dangling or degraded references, stale nodes, low-confidence relations, inferred relations, empty evidence, or path normalization issues
- **THEN** Project Map SHALL surface those as reviewable warnings
- **AND** warnings SHALL NOT automatically mutate semantic Project Map data
- **AND** warnings SHALL be clearable or collapsible from the UI

### Requirement: Project Map SHALL handle file paths across supported platforms

Project Map SHALL compare, display, and open file-backed evidence in a way that is compatible with Windows, macOS, and Linux path formats.

#### Scenario: File references use different platform separators

- **WHEN** Project Map compares node sources, related artifacts, relation evidence, changed files, or evidence records that use Windows `\` separators or POSIX `/` separators
- **THEN** Project Map SHALL normalize paths for matching
- **AND** it SHALL preserve the original user-facing display path when useful
- **AND** matching SHALL NOT rely on hard-coded path separators

#### Scenario: File reference includes editor line information

- **WHEN** a workspace file reference includes a one-based line number
- **THEN** Project Map SHALL preserve the one-based line reference when routing the file open request
- **AND** path normalization SHALL NOT drop or reinterpret the line reference

#### Scenario: File reference cannot be safely resolved

- **WHEN** a file reference is absolute, outside the workspace, uses an unsupported platform shape, or cannot be resolved against the active workspace
- **THEN** Project Map SHALL show it as degraded file context
- **AND** it SHALL NOT silently discard the reference
- **AND** it SHALL NOT treat user-local absolute path details as portable semantic project facts

### Requirement: Project Map SHALL handle large files responsibly

Project Map SHALL avoid full-content scanning or full-content rendering for large files and large evidence sets in query, activity, evidence navigation, and local context explanation.

#### Scenario: Query or evidence navigation touches a large file

- **WHEN** a query result, evidence record, recent activity item, or file reverse lookup points to a large or unavailable file
- **THEN** Project Map SHALL represent that file through metadata, matched fields, available evidence snippets, capped previews, counts, or degraded content markers
- **AND** it SHALL NOT require reading or rendering the full file content inside the Project Map panel

#### Scenario: Result groups are large

- **WHEN** query, activity, relation, or evidence result groups contain many items
- **THEN** Project Map SHALL cap or collapse visible results by default
- **AND** it SHALL keep the graph-first view responsive
- **AND** it SHALL provide summarized counts so hidden items are not mistaken for missing data

#### Scenario: Local explain-context uses evidence from large files

- **WHEN** the user activates local explain-context and the selected node references large or unavailable files
- **THEN** Project Map SHALL summarize from existing node metadata, relation metadata, evidence records, snippets, and risk flags
- **AND** it SHALL mark missing or oversized content as degraded context
- **AND** it SHALL NOT start a new AI generation run or full-file read to compensate

### Requirement: Project Map SHALL provide lightweight query history

Project Map SHALL provide lightweight query and navigation history to reduce disorientation in large maps.

#### Scenario: Query history is available

- **WHEN** the user performs project queries or focuses nodes from query results
- **THEN** Project Map SHALL be able to show recent query or navigation chips with a small bounded count
- **AND** selecting a chip SHALL restore the query or focus context
- **AND** the user SHALL be able to clear the visible history

### Requirement: Project Map SHALL explain node context locally

Project Map SHALL provide a lightweight "explain this node context" action derived from existing Project Map data without requiring a new AI generation run.

#### Scenario: User asks to explain selected node context

- **WHEN** the user activates the explain-context action for a selected node
- **THEN** Project Map SHALL summarize the selected node, related nodes, relation highlights, evidence sources, recent activity, stale/candidate state, and risk flags from existing dataset context
- **AND** the explanation SHALL distinguish deterministic evidence from inferred or degraded context
