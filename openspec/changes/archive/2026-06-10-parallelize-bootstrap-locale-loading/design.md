# Design / 设计

## Critical Path Classification / 关键路径分类

| Work | Proposed Phase | Reason |
|---|---|---|
| minimal client store preload | must-block-render | shell 需要稳定 settings/workspace basics |
| `import("./App")` | can-run-in-parallel | module fetch/parse 不应等待无关 storage work |
| current-locale i18n load | can-run-in-parallel | first render 需要当前语言文案，但不需要所有 locale |
| localStorage-to-file migration | post-render unless proven critical | shell 可安全渲染时不应被 migration 阻塞 |
| input history restore | post-render | composer 可以 empty history 初始渲染 |
| alternate locale load | on-demand | 只在 language switch 或 deterministic fallback path 需要 |

如果实现阶段发现某项确实 critical，必须记录 blocking invariant，不能仅凭历史顺序保留 blocking。

## Bootstrap Promise Shape / Promise 编排

目标结构：

```text
bootstrap:start
start app import
start critical store preload
start current locale load
await critical store + current locale + app module
render root
mark shell-ready / renderer-ready
start post-render migration and input history hydration
```

critical promise failure 继续走现有 fallback/error path。post-render failure 只写 bounded diagnostics，除非它影响用户可见状态。

## Dynamic Locale Loading / 动态 locale 加载

`src/i18n/index.ts` 应提供 async locale loading boundary。Startup 加载 stored/current language。Language switch 必须先 load target locale，再 commit visible language change。Missing-key fallback 可以通过 bounded fallback loader 或稳定 key fallback policy 实现，但行为必须 deterministic。

Startup module path 不应静态导入所有 full locale resources。

## Trace Contract / Trace 合同

startup trace 需要能把 delay 归因到 storage preload、migration、input history、i18n、app import、root render、shell-ready。payload 只包含 timing/status metadata，不包含 prompt、assistant text、tool output 或 file content。

## Rollback / 回滚

每个 layer 要能独立回滚：

- bootstrap 并行化出问题时，恢复 serialized bootstrap；
- input history hydration 出问题时，恢复 synchronous init；
- dynamic locale loading 出问题时，临时恢复 static imports，并保留 blocker 说明。
