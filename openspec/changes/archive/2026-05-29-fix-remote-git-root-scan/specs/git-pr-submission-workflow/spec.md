## ADDED Requirements

### Requirement: Remote Backend GitHub Panels and PR Workflow

GitHub Issues, Pull Requests, pull request diffs/comments, PR workflow defaults, and PR creation workflow SHALL execute against the active backend location. In remote daemon mode, desktop commands for these GitHub-backed features MUST delegate to daemon RPC so repository remote detection, GitHub token/environment, and Git state are evaluated on the daemon side.

#### Scenario: Remote GitHub issue and pull request reads use daemon context

- **WHEN** the app is in remote daemon mode and the GitHub panel loads issues, pull requests, PR diffs, or PR comments
- **THEN** desktop commands MUST call matching daemon RPC methods
- **AND** repository and GitHub context MUST be resolved on the daemon side

#### Scenario: Remote PR workflow uses daemon context

- **WHEN** the app is in remote daemon mode and PR workflow defaults or PR creation workflow are requested
- **THEN** desktop commands MUST call daemon RPC for those workflow methods
- **AND** branch, remote, and GitHub metadata MUST reflect the daemon-side repository

#### Scenario: Local GitHub behavior remains unchanged

- **WHEN** the app is in local backend mode and GitHub panel or PR workflow commands run
- **THEN** existing local behavior, return shape, and error semantics MUST be preserved
