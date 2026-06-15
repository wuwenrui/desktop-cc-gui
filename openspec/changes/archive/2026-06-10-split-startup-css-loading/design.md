# Design / 设计

## CSS Ownership Classes / CSS 归属分类

| Class | Load Timing | Examples |
|---|---|---|
| `critical` | before root render | globals、reset/tokens、base layout primitives |
| `first-visible-shell` | bootstrap if visible by default | sidebar shell、main shell、minimal messages、minimal composer |
| `feature-on-demand` | feature entry or activation | file view、settings、SpecHub、Git History、Kanban、search palette |
| `heavy-third-party` | explicit surface mount | Excalidraw CSS、CodeMirror editor styles |
| `legacy-global` | temporary escape hatch | 有跨 feature 依赖证据的 selectors |

留在 bootstrap 的 CSS 必须能说明 first-screen ownership；不能只是“之前就在这里”。

## Loading Pattern / 加载模式

优先在 feature activation 点附近动态加载 CSS，例如 dynamic `import("../styles/foo.css")`、feature style loader helper，或复用现有 lazy feature entry。

加载策略必须保证：

- shell 不因 feature CSS load 失败而崩溃；
- feature 可在 CSS loading 期间显示 stable skeleton；
- first-open 不展示 broken unstyled layout 作为 steady state。

## First-Screen Contract / 首屏合同

bootstrap CSS 只允许覆盖：

- app root layout 与 design tokens；
- window/shell structure；
- sidebar shell 与 first-visible session list primitives；
- main conversation shell；
- minimal message row / live row layout；
- minimal composer input/send controls；
- shared buttons、focus rings、scrollbars、accessibility primitives。

feature-specific detailed styling 必须下沉到 feature activation path。

## Measurement / 度量

通过 `bundle budget` gate 记录 `App-*.css` gzip before/after。具体 target 以 refreshed `v0.5.9` baseline 校准，本 change 的验收至少要求 measurable decrease。

## Rollback / 回滚

每个 CSS group 的 load timing move 应可独立回滚：把对应 import 恢复到 `src/bootstrap.ts` 即可。不要把 selector rewrite 和 load timing move 混在一起，除非 rewrite 是避免 visual regression 的必要条件。
