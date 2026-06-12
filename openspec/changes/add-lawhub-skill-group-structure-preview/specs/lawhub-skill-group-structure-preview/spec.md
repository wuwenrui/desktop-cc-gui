# lawhub-skill-group-structure-preview

lawhub 菜单 SHALL present installed market skills in a grouped, clickable list with local structure viewing and pre-install preview, without changing existing PPT/HTML behaviors.

## Requirement: lawhub menu is grouped into PPT and Skills

The expanded `lawhub` sidebar menu SHALL render two labelled groups: `PPT` (existing 制作 PPT entry and workspace HTML artifacts) and `技能` (bundled prompt skills, installed market skills, and an `添加技能` action).

### Scenario: groups render with existing behaviors intact

- WHEN the user expands `lawhub`
- THEN the menu SHALL show the `PPT` group containing 制作 PPT and workspace `*.html` rows with unchanged open/publish behaviors
- AND the `技能` group SHALL list 文件转 Markdown and 视觉 OCR first, followed by installed market skills, ending with `添加技能`.

## Requirement: installed market skills are listed by install order

The `技能` group SHALL source installed skills from the skillhub installed index and order them by `installed_at` ascending; entries without `installed_at` SHALL fall back to name order and sort before stamped entries.

### Scenario: newly installed skill appears immediately

- GIVEN the user installs a skill from the market dialog
- WHEN the installation completes
- THEN the `技能` group SHALL refresh and include the new skill without app restart.

### Scenario: legacy index without timestamps still works

- GIVEN `.skillhub-installed.json` entries lack `installed_at`
- WHEN the menu renders
- THEN deserialization SHALL succeed and entries SHALL be ordered by name.

## Requirement: clicking a skill injects it into the composer

Clicking an installed skill name SHALL dispatch the existing `ccgui:select-skill` event with the skill name, attaching a skill chip to the composer, and SHALL NOT send a message.

### Scenario: skill name click attaches chip

- WHEN the user clicks an installed skill name in the `技能` group
- THEN a `ccgui:select-skill` event SHALL fire with that name
- AND no chat message SHALL be sent.

## Requirement: installed skills expose a local structure viewer

Each installed market skill row SHALL provide a `查看` action opening a structure panel that reads the local `~/.claude/skills/<name>/` directory: a file tree pane and a content pane rendering selected text files. `sub-skills/*_SKILL.md` entries SHALL offer a one-click use action that injects the parent skill into the composer.

### Scenario: viewing structure offline

- GIVEN a skill is installed locally
- WHEN the user clicks `查看`
- THEN the panel SHALL show the file tree and SKILL.md content read from local disk without network access.

### Scenario: path traversal is rejected

- WHEN a tree or file request resolves outside `~/.claude/skills/<name>/`
- THEN the backend command SHALL reject the request with an error.

### Scenario: oversized or binary files degrade gracefully

- WHEN a selected file exceeds 512KB or is not valid UTF-8
- THEN the content pane SHALL show a truncation note or an unsupported-file notice instead of raw bytes.

## Requirement: market dialog offers pre-install preview

Selecting a skill in the market dialog SHALL show a preview pane with the skill's file tree and SKILL.md content fetched from the lawhub preview API, without writing any file locally.

### Scenario: preview before install

- GIVEN a skill is not installed
- WHEN the user selects it in the market dialog
- THEN the preview pane SHALL render its file tree and SKILL.md from the platform API
- AND no local file SHALL be created until the user clicks 添加.

### Scenario: preview API unavailable

- WHEN the preview API request fails
- THEN the preview pane SHALL show an error notice
- AND install SHALL remain available.

## Requirement: market dialog is reachable from the skills group

The `添加技能` action in the `技能` group SHALL open the same market dialog as the top-level `Skill 市场` entry.

### Scenario: both entries share one dialog

- WHEN the user activates `添加技能` or the top `Skill 市场` entry
- THEN the same market dialog instance SHALL open.
