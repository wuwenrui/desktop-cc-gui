# Design / 设计

## Budget Config / 预算配置

新增脚本层 JSON config，示例结构：

```json
{
  "schemaVersion": "1.0",
  "groups": [
    {
      "id": "app-js",
      "patterns": ["App-*.js"],
      "unit": "bytes-gzip",
      "target": 950000,
      "hardFail": null,
      "mode": "advisory"
    }
  ]
}
```

`target`、`hardFail`、`mode` 分开，允许先观测和提示，再在对应优化落地后切换到 fail-fast。

## Script Behavior / 脚本行为

`check-bundle-chunking.mjs` 保留现有 chunk existence checks，然后执行：

1. 读取 `dist/assets`。
2. 统计 raw file size。
3. 使用 Node `zlib` 计算 gzip bytes。
4. 按 budget patterns 分组。
5. 输出 pass/advisory/fail rows。
6. 只有 fail-mode 超过 hardFail 或 required chunk 缺失时 exit non-zero。

## Startup Eagerness / 首屏 eager 证据

heavy optional chunks 必须保持 optional/lazy。checker 如果能从 Rollup/Vite metadata 判断 startup import path，则输出 `measured-lazy` 或 `measured-eager`。如果不能可靠判断，输出 `not-measured`，不得描述为 startup-safe。

## Rollout / 推进顺序

- Phase 1：引入 measurement 与 advisory budgets，不阻塞当前已知超标 output。
- Phase 2：CSS/bootstrap/AppShell/file-preview 优化后，把对应 budget 切换为 fail mode。
- Phase 3：把命令接入 pre-release checklist 或 CI gate。
