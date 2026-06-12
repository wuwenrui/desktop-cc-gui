# Environment Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-click macOS environment bootstrap flow that checks dependencies, installs Homebrew through TUNA when missing, installs brew packages, and shows progress.

**Architecture:** Add a dedicated Rust environment installer command set and event channel, then replace the narrow startup dependency gate with a React bootstrap gate. Keep the existing CLI installer untouched and compose with it only conceptually so settings behavior stays compatible.

**Tech Stack:** Rust/Tauri commands, React 19, TypeScript, Vitest, Cargo tests.

---

### Task 1: Backend Types And Plan Builder

**Files:**
- Create: `src-tauri/src/environment_installer.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/command_registry.rs`
- Test: `src-tauri/src/environment_installer.rs`

- [ ] Write Rust unit tests for dependency ordering, TUNA mirror URLs, and log redaction.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml environment_installer`.
- [ ] Implement `environment_doctor`, `environment_install_plan`, `environment_install_run`.
- [ ] Register the module and commands.
- [ ] Re-run the Rust tests.

### Task 2: Frontend Types And Tauri Bridge

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/events.ts`
- Modify: `src/services/tauri.ts`
- Create: `src/services/tauri/environmentInstaller.ts`
- Test: `src/services/tauri.test.ts`
- Test: `src/services/events.test.ts`

- [ ] Write failing TypeScript tests for command bridge and event subscription.
- [ ] Run `npx vitest run src/services/tauri.test.ts src/services/events.test.ts`.
- [ ] Add environment installer types and service exports.
- [ ] Re-run the targeted tests.

### Task 3: Startup Bootstrap Gate

**Files:**
- Create: `src/features/setup/EnvironmentBootstrapGate.tsx`
- Create: `src/features/setup/__tests__/EnvironmentBootstrapGate.test.tsx`
- Modify: `src/app-shell.tsx`

- [ ] Write failing UI tests for ready, missing Homebrew, progress, failure, and retry states.
- [ ] Run `npx vitest run src/features/setup/__tests__/EnvironmentBootstrapGate.test.tsx`.
- [ ] Implement the React gate and wire it into app startup.
- [ ] Re-run the targeted UI test.

### Task 4: Verification

**Files:**
- All changed files.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run targeted Vitest suites.
- [ ] Run targeted Cargo tests.
- [ ] Run `git status --short --branch` and report unrelated dirty files separately.
