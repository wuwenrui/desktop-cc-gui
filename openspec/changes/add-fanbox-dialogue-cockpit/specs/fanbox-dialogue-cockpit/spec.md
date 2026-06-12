# fanbox-dialogue-cockpit

The desktop client SHALL keep dialogue as the primary workflow while making AI citations, changes, and pending confirmations visible at all times, in user language, without a dark reskin.

## Requirement: assistant replies expose a source summary

An assistant message whose content contains completed tool calls SHALL render a source summary block at the end of the bubble, showing cited files (Read/NotebookRead) and change hotspots (Edit/Write/MultiEdit/NotebookEdit with edit counts). Messages without such signals SHALL NOT render the block.

### Scenario: reply with reads and edits

- GIVEN an assistant message containing completed Read and Edit tool calls
- WHEN the message renders
- THEN the summary SHALL show the cited file count and the changed file with its edit count.

### Scenario: plain reply stays clean

- GIVEN an assistant message with no tool calls
- WHEN the message renders
- THEN no summary block SHALL be rendered.

### Scenario: clicking a summary chip opens the matching inspector tab

- WHEN the user clicks the cited-files chip
- THEN the right inspector SHALL switch to the evidence tab
- AND clicking the change-hotspot chip SHALL switch to the changes (git) tab.

## Requirement: inspector offers four user-language tabs without losing existing capabilities

The right inspector toolbar SHALL present four text tabs — 证据 / 改动 / 记忆 / 日志 — where 改动 maps to the existing git panel and 日志 maps to the existing activity panel plus a terminal entry. All pre-existing icon tabs SHALL remain reachable via an overflow control.

### Scenario: four tabs render and switch

- WHEN the inspector toolbar renders
- THEN 证据/改动/记忆/日志 four text tabs SHALL be visible
- AND selecting each SHALL show its mapped panel.

### Scenario: existing tabs survive behind overflow

- WHEN the user opens the overflow control
- THEN files/search/notes/radar/projectMap/intentCanvas tabs SHALL be selectable as before.

### Scenario: terminal is demoted, not removed

- WHEN the user opens the 日志 tab
- THEN a 展开终端 entry SHALL be available that opens the existing terminal dock
- AND the terminal SHALL NOT be required for any primary dialogue flow.

## Requirement: session casebar provides 对话/文件/证据 views

The conversation column SHALL show a casebar above messages with the session title and a three-way view switch. 文件 view SHALL list session file activity (reads/edits per file) derived from message tool calls; 证据 view SHALL show the latest reply's evidence digest. Switching views SHALL NOT change global center mode or leave the session.

### Scenario: file view aggregates session activity

- GIVEN a session whose assistant messages read and edited files
- WHEN the user switches to 文件
- THEN file cards SHALL list those files ordered by edit count.

### Scenario: empty session shows empty states

- GIVEN a session with no tool-call signals
- WHEN the user switches to 文件 or 证据
- THEN an explanatory empty state SHALL render instead of fabricated data.

## Requirement: 文件 view shows a dual-zone layout with the full workspace tree

When workspace file data is available, the 文件 view SHALL render two zones: an upper zone listing session file activity cards, and a lower zone rendering the full workspace file tree (same data source as the right-panel file tree). Tree files touched in the session SHALL carry heat badges (edit count in warning color, read count in info color) matched by path suffix, and their ancestor folders SHALL be expanded by default. The tree SHALL support search filtering, expand-all/collapse-all, and clicking a file SHALL open it via the existing onOpenFile path. Without workspace data the view SHALL fall back to the single-zone session list.

### Scenario: dual zones render with heat badges

- GIVEN a session that edited `case/风险清单.md` twice and a workspace containing that file
- WHEN the user switches to 文件
- THEN the upper zone SHALL show the session activity card
- AND the lower tree SHALL show `case` expanded with `风险清单.md` carrying an edit-count badge.

### Scenario: tree search filters files

- WHEN the user types a query in the tree search box
- THEN only matching files and their ancestor folders SHALL remain visible, expanded.

### Scenario: clicking a tree file opens it

- WHEN the user clicks a file row in the workspace tree
- THEN the file SHALL open through the existing workspace onOpenFile path.

## Requirement: narrow screens collapse the inspector cleanly

Below the compact breakpoint the inspector SHALL be hidden or presented as an overlay; it SHALL never render partially clipped. Summary-chip clicks while hidden SHALL request the inspector to open.

### Scenario: no half-clipped inspector at 1440 and below

- WHEN the window narrows past the compact breakpoint
- THEN the inspector SHALL fully hide or overlay
- AND screenshots at 1920/1440 SHALL show no clipped panel.

## Requirement: fork red lines stay intact

The change SHALL NOT modify SkillMarketButton/UsageBadge placement in MainTopbar, the left sidebar structure, or the composer interaction.

### Scenario: topbar fork patches survive

- WHEN the redesign renders
- THEN MainTopbar SHALL still contain SkillMarketButton and UsageBadge as per FORK-PATCHES.md.
