# Design / 设计

## Static Surface Classes / 静态面分类

| Class | Meaning | Startup Policy |
|---|---|---|
| `critical-shell` | first screen layout, sidebar shell, active conversation shell, composer minimum | eager allowed |
| `always-on-runtime` | renderer ready, runtime notices, active session lifecycle essentials | eager allowed with explicit reason |
| `route-or-tab-on-demand` | SpecHub, Git History, Kanban, WorkspaceHome, settings-like routes | lazy |
| `modal-on-demand` | release notes, docs, detached surfaces, optional dialogs | lazy |
| `legacy-coupled` | temporarily static because contract is not isolated yet | allowed only with owner/follow-up |

## Boundary Rule / 边界规则

AppShell may compose layout and typed actions, but MUST NOT directly import low-frequency feature implementation modules when a lazy boundary can preserve behavior.

Typed boundaries should prefer explicit prop groups:

- `ShellRuntimeActions`
- `ShellNavigationActions`
- `ShellContextActions`
- `ShellFeatureActivationState`

Avoid replacing `@ts-nocheck` with broad `Record<string, unknown>` or `any` bags.

## Lazy Loading Rule / 懒加载规则

Use `React.lazy` / dynamic import around feature panes and modal bodies. Do not suspend the whole shell. Fallback should be feature-local and stable.

## Evidence / 证据

Evidence must include:

- static import inventory before/after;
- build chunk summary for `App-*.js`;
- list of retained eager feature imports with reason;
- typecheck result after removing `@ts-nocheck`.

## Rollback / 回滚

Each feature lazy boundary should be independently reversible by restoring the previous static import. Type-boundary changes should remain even if one feature lazy move is rolled back.
