# Curated Skill PR Review Checklist (v0.5.14+)

在 `src-tauri/resources/curated-skills/<id>/` 新增任何 curated skill **或修改既有 curated entry** 时,reviewer **必须**按下面 9 项逐条走完。每条对应 proposal §4 与 design.md 的硬约束,缺一不可。

## R1. `SKILL.md` 顶部含 attribution 注释

文件**第一行**必须是 HTML 注释,标明 upstream 仓库 + commit/tag + license:

```markdown
<!-- Upstream: https://github.com/<owner>/<repo>/blob/<sha-or-tag>/AGENTS.md | License: <SPDX-id> -->
```

不接受的形式:

- 注释在文件中间 (e.g. 第 2 段)
- 注释行带尾随空行超过 1 个
- 注释里没有 license 字段

## R2. `metadata.json` 字段完整

必须包含且非空的字段:

| 字段 | 类型 | 备注 |
|---|---|---|
| `name` | string | kebab-case ASCII,跟目录名一致;**不能**与 `skills-lock.json` 其它 entry 冲突 |
| `displayName` | string | 用户可见名,允许空格 / 中文 |
| `version` | string | semver 推荐 |
| `description` | string | 用户在 picker / Curated section 看到的描述,1-2 句 |
| `icon` | string | kebab-case ASCII (R5) |
| `category` | enum | MVP 4 个 (R6) |
| `tokenEstimate` | integer | R7 上限 |
| `source` | string | `upstream: <owner>/<repo> v<version>` 格式 |
| `license` | SPDX id | R4 白名单 |

## R3. `skills-lock.json` `computedHash` 与 SKILL.md 真实 sha256 一致

```bash
shasum -a 256 src-tauri/resources/curated-skills/<id>/SKILL.md
# 输出末尾的 hex 必须等于 skills-lock.json 里该 entry 的 computedHash
```

PR 必须包含 `computedHash` 字段更新 (或 PR author 在 description 写明"本 PR 仅文档/UI 修改,未触碰 SKILL.md")。

## R4. `license` 在白名单

白名单 (V0.5.14): `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`

**不收** `MPL-2.0` (V1.1 走法律评审), `GPL-*`, `LGPL-*`, `AGPL-*`, `Proprietary`, `Unlicense`, `CC0-1.0`。

接受但**需要额外 review**: 仓库根有 `LICENSE` 文件**且** SPDX header 在 `SKILL.md` 顶部 attribution 注释里**且** upstream README 明确 license 的情况下,允许 SPDX 同名 license。

## R5. `icon` 字段是 kebab-case ASCII

正则: `^[a-z0-9-]+$`

- 不收: `Sparkles`, `sparkles_icon`, `icon-sparkles`, `火`, `sparkles.svg`
- `lucide-react` 实际导出名是 `sparkles`,`message-square`,`file-text` 等,需要在 PR author 自测里跑 `node -e "import('lucide-react/dist/esm/icons/<icon>.js').then(() => console.log('ok'))"`
- 完整 icon 名白名单 V1.1 引入,V0.5.14 走 PR review 人工 verify

## R6. `category` 在 MVP 4 个枚举

| 值 | 含义 | 范例 |
|---|---|---|
| `code-style` | 代码风格 / 最佳实践 | lazy-senior-dev (ponytail) |
| `ui-design` | UI / 设计 / 视觉 | (huashu-design 后续上) |
| `review` | review 流程 / 模式 | (V1.1) |
| `debug` | 调试 / 排错 | (V1.1) |

V1.1 扩到 8 个 (`performance`, `test`, `docs`, `git`)。V0.5.14 PR 不接受其它 category。

## R7. `tokenEstimate` 不超 3000

```bash
wc -c src-tauri/resources/curated-skills/<id>/SKILL.md | awk '{print $1 / 3}' # 粗估
```

MVP 上限 3000 tokens,经验值 `chars/3` 估算时:

- 英文主导: 偏差 < 15%
- 中文主导: 偏差 50%+ (V1.1 引入 `tiktoken-rs` 精算)
- 偏差 > 30% 的 skill **不收**

## R8. 命名不冲突

`name` 字段必须**不与**:

- `skills-lock.json` 任何其它 `kind: "curated"` entry 的 `name` 冲突
- `skills-lock.json` 任何 `kind: "bundled"` entry 的 `name` 冲突 (这 9 个 entry 虽没真落盘但**保留命名空间**)
- 既有 Codex / Claude marketplace skill 冲突 (reviewer 抽样查 `codex plugin marketplace search <name>`)

冲突时 PR author 必须 rename (e.g. 加 `-v2` 后缀),不接受**保留旧名 + 加 alias**的方案。

## R9. 含 "When NOT to enable" 反向说明

`SKILL.md` **正文末尾**必须有 "When NOT to enable" 章节,列举至少 3 个**不应该**启用此 skill 的真实场景。例 (lazy-senior-dev):

```markdown
## When NOT to enable

- 任务需要严格按 spec 实现 (e.g. 写 RFC 文档、按 mock 写测试桩) — lazy 风格的 "最简实现" 会绕开 spec
- 团队处于 oncall / 紧急修复场景 — 速度优先于精炼,7 级 Ladder 会拖慢
- 跨语言 / 跨框架迁移 (e.g. Python 2 → 3) — 需要保守的 diff 大小,Ladder 风格会过度精简
```

不接受的形式:

- 只写 "use with caution" 一句话
- 反向说明在 README 而不在 SKILL.md
- 反向说明全在 metadata.json 的 description 里 (用户看不到完整上下文)

## 通过门槛

9 项全 pass 才能 merge。任一 fail → request changes,**不** squash + re-push 通过 review。

## 关联文档

- `docs/curated-skill-onboarding.md` — 主准入规则文档 (含回退路径 + V1.1 follow-up 表)
- `openspec/changes/2026-06-24-curated-skill-bundles/design.md` — 架构决策
- `openspec/changes/2026-06-24-curated-skill-bundles/proposal.md` — 用户故事 + 验收 Gate
