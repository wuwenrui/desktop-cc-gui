<div align="center">

# Desktop CC GUI

<img width="120" alt="Image" src="./icon.png" />

**English** · [简体中文](./README.zh-CN.md)

<a href="https://trendshift.io/repositories/25546" target="_blank"><img src="https://trendshift.io/api/badge/repositories/25546" alt="zhukunpenglinyutong%2Fdesktop-cc-gui | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

![][github-contributors-shield] ![][github-forks-shield] ![][github-stars-shield] ![][github-issues-shield]

</div>

**ccgui** is a cross-platform desktop AI engineering workbench for professional developers. It brings multiple coding engines, project context, task execution, terminal, Git, memory, and governance surfaces into one transparent local-first client.

The current application is built on **Tauri 2 + React 19 + TypeScript + Vite** and focuses on making AI-assisted development observable, recoverable, and auditable instead of hiding work inside a single chat box.

> This project originated from [CodexMonitor](https://github.com/Dimillian/CodexMonitor) and has evolved into a broader multi-engine coding client.

<img src="./docs/banner.png" alt="ccgui Banner" width="800" />

---

## Core Capabilities

### Multi-Engine AI Workbench

Manage multiple coding engines in one interface and switch between them by task:

- **Claude Code** — session continuity, history visibility, context usage surfaces, compact/reasoning controls, and runtime recovery flows.
- **Codex CLI** — launch profile support, plan visibility, collaboration-mode enforcement, queued follow-up continuity, and runtime diagnostics.
- **OpenCode CLI** — provider / MCP / session control surfaces.
- **Gemini CLI** — supported as an engine integration path.
- **Custom Providers** — configurable official, regional, aggregator, and third-party channels.

### Professional Development Surfaces

ccgui is more than chat. It is a local development cockpit:

- **Chat Canvas** — rich input, attachments, file references, slash commands, streaming messages, tool cards, and rewind/review surfaces.
- **Composer** — persistent input, file-tree assisted references, note cards, queued follow-ups, and shortcut action menus.
- **Built-in Terminal** — xterm.js terminal with pseudo-TTY support and configurable shell behavior.
- **Git Panel** — history, branches, worktrees, diffs, file view, and high-risk merge workflow support.
- **Kanban + Plan Panels** — task breakdown, planning state, and execution-oriented task management.
- **Task Center / TaskRun** — AI execution records, runtime states, diagnostics, retries, and output inspection.
- **Session Activity** — workspace-level session aggregation and linked conversation navigation.

### Project Intelligence

- **Project Map / Project X-Ray** — evidence-backed project knowledge graph, source references, confidence/stale markers, candidate review, and incremental generation.
- **Project Memory** — persistent semantic memory with multiple memory kinds and reusable context.
- **Context Ledger** — context source attribution, cost/budget visibility, transition diffs, and governance-oriented review surfaces.
- **SpecHub / Governance Panels** — OpenSpec/spec provider awareness, runtime evidence gates, status panels, and optional workflow evidence adapters.

### AI Runtime Safety

- **Structured model output normalization** — shared parser/repair/validator path for untrusted model JSON before feature code consumes it.
- **Runtime stability contracts** — realtime batching, settlement diagnostics, stalled recovery, lifecycle hardening, and global client error logs.
- **Computer Use bridge** — explicit status/availability surfaces and Codex CLI/plugin handoff boundaries.
- **Local-first diagnostics** — doctor scripts, runtime contract checks, large-file governance, and performance baselines.

### Cross-Platform Native Experience

- **macOS** — frameless native window integration, Apple Silicon / Intel / Universal build targets.
- **Windows** — dedicated Tauri config and Windows build flow.
- **Linux** — AppImage build target and Linux startup guards.
- **Auto-update** — updater artifacts and release endpoint support.

---

## Local Development

### 1. Prerequisites

Install the following tools:

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) stable
- [Tauri CLI](https://tauri.app/) (`npm install -g @tauri-apps/cli`)
- cmake

Run the environment check:

```bash
npm run doctor
```

For stricter app startup checks:

```bash
npm run doctor:strict
```

### 2. Install Dependencies

This repository enforces npm through the preinstall script:

```bash
npm install
```

### 3. Start Development Mode

```bash
npm run tauri:dev
```

The first launch compiles the Rust backend. Later launches use incremental builds.

Frontend-only development is available with:

```bash
npm run dev
```

### 4. Build Production Packages

```bash
# macOS Apple Silicon
npm run build:mac-arm64

# macOS Intel
npm run build:mac-x64

# macOS Universal
npm run build:mac-universal

# Windows x64
npm run build:win-x64

# Linux x64
npm run build:linux-x64

# Linux arm64
npm run build:linux-arm64
```

### 5. Quality Gates

```bash
npm run lint
npm run typecheck
npm run test
npm run check:runtime-contracts
npm run check:large-files
```

Focused gates also exist for engine capability routing, context ledger budgets, checkpoint policy chains, runtime evidence, native menu usage, bundle chunking, and performance baselines. See `package.json` for the current command list.

---

## Documentation Map

- `AGENTS.md` — repository rules, reading order, PlanFirst gate, and workflow boundaries.
- `openspec/README.md` — OpenSpec workspace navigation.
- `openspec/project.md` — current OpenSpec governance snapshot.
- `.trellis/spec/**` — implementation rules and executable contracts.
- `docs/architecture/**` — architecture governance and large-file policies.
- `docs/perf/**` — performance baselines and runtime evidence reports.

---

## Download

Download link: https://github.com/zhukunpenglinyutong/desktop-cc-gui/releases

---

## License

[MIT](https://github.com/zhukunpenglinyutong/desktop-cc-gui?tab=MIT-1-ov-file)

---

## Friendship Link

Thanks for the support and feedback from the friends at [LINUX DO](https://linux.do/).

---

## Contributors

Thanks to all the contributors who help make ccgui better.

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/zhukunpenglinyutong">
        <img src="https://avatars.githubusercontent.com/u/31264015?size=100" width="100" height="100" alt="zhukunpenglinyutong" style="border-radius: 50%; border: 3px solid #ff6b35; box-shadow: 0 0 15px rgba(255, 107, 53, 0.6);" />
      </a>
      <div>🔥🔥🔥</div>
    </td>
    <td align="center">
      <a href="https://github.com/chenxiangning">
        <img src="https://avatars.githubusercontent.com/u/19299585?size=100" width="100" height="100" alt="chenxiangning" style="border-radius: 50%;" />
      </a>
      <div>🔥🔥🔥</div>
    </td>
    <td align="center">
      <a href="https://github.com/youcaizhang">
        <img src="https://avatars.githubusercontent.com/u/95678323?size=100" width="100" height="100" alt="youcaizhang" style="border-radius: 50%;" />
      </a>
    </td>
  </tr>
</table>

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zhukunpenglinyutong/desktop-cc-gui&type=date&legend=top-left)](https://www.star-history.com/#zhukunpenglinyutong/desktop-cc-gui&type=date&legend=top-left)

<!-- LINK GROUP -->

[github-contributors-shield]: https://img.shields.io/github/contributors/zhukunpenglinyutong/desktop-cc-gui?color=c4f042&labelColor=black&style=flat-square
[github-forks-shield]: https://img.shields.io/github/forks/zhukunpenglinyutong/desktop-cc-gui?color=8ae8ff&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/zhukunpenglinyutong/desktop-cc-gui/issues
[github-issues-shield]: https://img.shields.io/github/issues/zhukunpenglinyutong/desktop-cc-gui?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/zhukunpenglinyutong/desktop-cc-gui/blob/main/LICENSE
[github-stars-shield]: https://img.shields.io/github/stars/zhukunpenglinyutong/desktop-cc-gui?color=ffcb47&labelColor=black&style=flat-square
