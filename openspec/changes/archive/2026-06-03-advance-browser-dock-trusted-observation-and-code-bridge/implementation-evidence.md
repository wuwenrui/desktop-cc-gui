# Implementation Evidence - Browser Dock Trusted Observation and Code Bridge

Date: 2026-06-03

This document calibrates the OpenSpec change against the current browser-related working tree changes.

## Code Matrix

| Area | Code paths | Implemented evidence |
| --- | --- | --- |
| Tauri Browser Agent | `src-tauri/src/browser_agent/mod.rs`, `src-tauri/src/browser_agent/types.rs`, `src-tauri/src/browser_agent/capture_script.rs`, `src-tauri/src/command_registry.rs`, `src-tauri/capabilities/default.json` | Renderer window, toolbar bridge, capture bridge, safe actions, snapshot refresh, DTOs, command registration, permissions, toolbar i18n, multi-tab session routing. |
| Detached Browser Dock | `src/features/browser-agent/browserAgentDockWindow.ts`, `src/features/browser-agent/components/DetachedBrowserAgentWindow.tsx`, `src/styles/browser-agent-window.css`, `src/router.tsx` | Browser Dock opens as detached renderer window instead of occupying the main layout center panel. |
| Dock Coordination | `src/features/browser-agent/components/BrowserDock.tsx`, `src/features/browser-agent/hooks/useBrowserAgentDockSession.ts`, `src/features/browser-agent/state/activeBrowserContext.ts`, `src/features/browser-agent/state/browserContextAttachmentCommands.ts` | Session/window coordination, active browser context state, attach command bus, locale propagation into Tauri open command. |
| Trusted Capture | `src/features/browser-agent/capture/read-only-capture-script.js`, `src/features/browser-agent/capture/readOnlyCaptureScript.fixture.test.ts`, `src/features/browser-agent/utils/readOnlyCaptureScript.ts` | Canonical read-only capture script, fixture-level coverage target, utility export path. |
| Evidence UI | `src/features/browser-agent/evidence/*`, `src/features/browser-agent/visual-evidence/*`, `src/features/browser-agent/components/BrowserEvidencePanel*`, `src/features/browser-agent/components/BrowserContextPreview*`, `src/features/browser-agent/components/BrowserContextSummaryCard.tsx` | Evidence inspector, visual evidence gate/reference, context preview and summary display. |
| Action Audit | `src/features/browser-agent/actions/*`, `src/features/browser-agent/components/BrowserActionAuditTrail*` | Safe action preview and audit trail surface for browser actions. |
| Annotation Contract | `src/features/browser-agent/annotations/*` | Structured annotation contracts for page evidence. |
| Code Bridge | `src/features/browser-agent/code-bridge/*`, `src/features/browser-agent/utils/codeCandidates.ts`, `src/features/browser-agent/utils/codeCandidates.test.ts` | Browser evidence to code candidate bridge and extraction utilities. |
| Cross-layer Task/Thread Context | `src/features/threads/hooks/useThreadMessaging.ts`, `src/features/tasks/types.ts`, `src/features/tasks/utils/taskRunStorage.ts`, `src/types.ts` | Browser evidence/candidate fields carried into thread messaging and task run persistence. |
| Tauri Frontend Service | `src/services/tauri/browserAgent.ts`, `src/services/tauri.ts` | Browser Agent command wrappers, including locale-aware `openBrowserAgentWindow`. |
| Main Layout Integration | `src/features/layout/hooks/useLayoutNodes.tsx`, `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` | Browser Dock removed from main layout center panel and delegated to detached dock window flow. |
| File Tree Drag Bridge | `src/features/files/utils/fileTreeDragBridge.ts`, `src/features/files/components/FileTreePanel.tsx` | Drag bridge extracted from FileTreePanel, reducing unrelated panel complexity touched by browser code bridge integration. |
| I18n | `src/i18n/locales/en.part1.ts`, `src/i18n/locales/zh.part1.ts`, `src/features/browser-agent/components/BrowserDock.tsx`, `src-tauri/src/browser_agent/mod.rs` | React UI i18n and Rust-injected toolbar i18n are both covered. |

## Notable Fixes Recorded

### Multi-tab toolbar action targeting

Toolbar bridge actions now parse `sessionId` and `workspaceId` from the active toolbar URL query. This prevents attach/open/close/activate actions from targeting the stale session captured when the toolbar was first created.

### Toolbar i18n

`open_browser_agent_window` accepts an optional locale, frontend callers pass `i18n.language`, and Rust resolves toolbar labels through `browser_toolbar_labels(locale)`.

## Current Status

- Implementation state: substantially implemented in working tree.
- Documentation state: calibrated by this writeback.
- Verification state: not executed in this session.
- Archive readiness: not ready until verification is run and residual risks are resolved or accepted.
