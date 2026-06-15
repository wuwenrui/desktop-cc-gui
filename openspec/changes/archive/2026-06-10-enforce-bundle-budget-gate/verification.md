# Verification / 验证记录

## Commands / 命令

- `npm run build` passed。
- `npm run check:bundle-chunking` passed。

## Bundle Gate Evidence / Bundle gate 证据

`npm run check:bundle-chunking` 输出 structured budget summary：

- `app-js`: `advisory`，gzip 约 `1.30 MiB`，target `927.7 KiB`，hardFail `1.05 MiB`。
- `app-css`: `advisory`，gzip 约 `262.4 KiB`，target `175.8 KiB`，hardFail `214.8 KiB`。
- `total-js-mjs-css`: `advisory`，gzip 约 `5.59 MiB`，target `4.58 MiB`，hardFail `5.05 MiB`。
- `vendor-mermaid`: `pass`，gzip 约 `657.1 KiB`，startup eagerness `not-measured`。
- `vendor-codemirror`: `pass`，gzip 约 `295.0 KiB`，startup eagerness `not-measured`。
- `vendor-docs`: `pass`，gzip 约 `384.6 KiB`，startup eagerness `not-measured`。

## Notes / 说明

- First rollout 使用 `advisory` mode，避免在优化尚未落地前用 future hardFail 阻塞主线。
- heavy optional chunks 暂无可靠 startup import graph metadata，因此明确输出 `not-measured`，不把 unknown 描述成 startup-safe。
- `npm run build` 仍输出既有 Vite warning：`FileViewPanel.tsx` 同时被 dynamic import 和 static import，后续 `file-preview heavy dependency lazy loading` P0 应处理该问题。
