# 执行任务：修正 lawyer-copilot 敏感 skill 清理名单

> 本文档供**新对话的 agent** 执行。生成它的上一个会话工具输出被污染过，因此：
> - **可信**：任务目标、真实泄露清单（来自用户截图）、代码设计机制。
> - **不可信、需你亲自核实**：本文档对「当前代码现状」的任何描述。动手前先读真实文件确认。

---

## 1. 任务目标（一句话）

把 `lawyer-copilot/src-tauri/src/skill_installer.rs` 里的敏感 skill 清理黑名单 `SENSITIVE_BUNDLED_SKILL_PATHS` 改成**正好覆盖下列 8 个真实泄露的 skill**：移除多余项、补齐缺失项。

---

## 2. 背景：这套机制是干什么的

lawyer-copilot 桌面端之前**误把一批敏感律师业务 skill 打包分发给了用户**。`skill_installer.rs` 负责善后，设计是「**一份黑名单驱动三件事**」：

```
SENSITIVE_BUNDLED_SKILL_PATHS  (黑名单常量)
        │
        ├─ 启动清理：app 每次启动 → sync_bundled_skills_on_startup
        │            → 从用户 ~/.claude/skills/ 删掉名单里的每一项（回收已泄露副本）
        ├─ 安装跳过：install 时遇到名单里的项就跳过（不再分发）
        └─ 删除方式：按「相对路径名」匹配 → 删文件 + 清空空父目录
```

因此**只改这个名单常量即可**，删除函数 / 启动钩子 / 安装逻辑都自动读它，无需改动。

---

## 3. 上一个会话已做的改动（哪个对、哪个错）

上个会话对 `skill_installer.rs` 做了两件事：

| 改动 | 评价 | 你要做的 |
|------|------|---------|
| A. 删除逻辑从「按文件内容 sha256 哈希删」改为「按文件名删」（删掉了 `SensitiveBundledSkill` struct、`LEGACY_SENSITIVE_BUNDLED_SKILLS`、`sha256_hex`、`use sha2`） | **正确，保留** | 核实它确实改成了纯文件名匹配且能编译 |
| B. 往名单里**加了 `风控制度小助手.md` 和 `风控制度小助手/SKILL.md`** | **错误，撤销** | 删掉这两条——风控制度小助手不在真实泄露列表里 |

> 为什么 A 是对的：hash 匹配只删「和泄露版本一字不差」的文件，用户改过一个字就漏删；改成按文件名删能确保泄露内容必删。代价是会删掉用户自建的同名 skill —— 用户已确认接受。

---

## 4. 地面真相：真实需要清理的 8 个 skill（用户截图，权威）

```
制度审查.md
劳动用工小助理/SKILL.md       ← 这是一个【文件夹】，里面是 SKILL.md
合同起草与审查.md
合同审查.md                    ← 与上一个是【两个不同文件】，勿混淆、勿漏
律师函（催款类）.md
破产业务小助手.md
法律意见.md
撰写不良资产尽调报告.md
```

共 8 项（7 个单文件 `.md` + 1 个文件夹形态 `劳动用工小助理/SKILL.md`）。

---

## 5. 执行步骤

1. **读真实文件**，定位 `const SENSITIVE_BUNDLED_SKILL_PATHS: &[&str] = &[ ... ];`，记录其当前实际内容（不要相信本文档对现状的猜测）。
2. **把它改成正好这 8 项**（顺序不重要）：
   ```rust
   const SENSITIVE_BUNDLED_SKILL_PATHS: &[&str] = &[
       "制度审查.md",
       "劳动用工小助理/SKILL.md",
       "合同起草与审查.md",
       "合同审查.md",
       "律师函（催款类）.md",
       "破产业务小助手.md",
       "法律意见.md",
       "撰写不良资产尽调报告.md",
   ];
   ```
   - 删掉 `风控制度小助手.md` 与 `风控制度小助手/SKILL.md`
   - 确认 `合同审查.md` 在（易与「合同起草与审查.md」混淆而漏掉）
3. **不要改其他任何地方**——删除函数、启动钩子、安装跳过都自动用这个名单。
4. **核实删除逻辑仍是纯文件名匹配**（上个会话改动 A）：确认函数 `remove_sensitive_bundled_skills_with_manifest` 签名是 `manifest: &[&str]`，函数体里**没有** `std::fs::read` 读内容、**没有** `sha256` 比对；全文不再有 `SensitiveBundledSkill` / `LEGACY_SENSITIVE_BUNDLED_SKILLS` / `sha256_hex` / `use sha2`。若仍有残留，一并清掉（让代码能编译）。
5. **编译 + 测试验证**：
   ```bash
   cd /Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot/src-tauri
   cargo test skill_installer
   ```
   预期：0 个 `error`，`test result: ok. N passed; 0 failed`（会有大量 `filtered out`，**正常**，因为只跑 skill_installer 模块）。
6. **提交 / 发版**（由用户确认后再做）：发版后，用户**下次启动 app 自动清理**他们 `~/.claude/skills/` 下的这 8 个，无需用户手动操作。

---

## 6. 验收标准（全部满足才算完成）

- [ ] `SENSITIVE_BUNDLED_SKILL_PATHS` 正好是第 4 节的 8 项，**不含风控制度小助手**。
- [ ] `合同审查.md` 与 `合同起草与审查.md` 都在名单里。
- [ ] 删除逻辑为纯文件名匹配，全文无 `SensitiveBundledSkill` / `sha256_hex` / `sha2` 残留。
- [ ] `cargo test skill_installer` 编译通过、0 failed。

---

## 7. 易错点

1. **`合同审查.md` ≠ `合同起草与审查.md`**，是两个不同文件，两个都要在名单里。
2. **`劳动用工小助理` 是文件夹**，路径写成 `劳动用工小助理/SKILL.md`；其余 7 个是单文件 `.md`。删除逻辑删掉该文件后会自动清空空文件夹（`remove_empty_parent_dirs`）。
3. **路径形态必须与用户机器上的实际落盘一致**——删除是按相对路径名精确匹配的，路径写错就删不掉。若不确定某个 skill 在用户端是单文件还是文件夹形态，需向用户确认。

---

## 8. 关键文件 / 命令

- 要改：`lawyer-copilot/src-tauri/src/skill_installer.rs` —— 常量 `SENSITIVE_BUNDLED_SKILL_PATHS`
- 启动钩子（不用改，仅供理解）：`lawyer-copilot/src-tauri/src/lib.rs` 的 `.setup()` → `sync_bundled_skills_on_startup` → `remove_legacy_sensitive_bundled_skills`
- 验证：`cd lawyer-copilot/src-tauri && cargo test skill_installer`
- 清理目标目录（运行时）：用户的 `~/.claude/skills/`

---

## 9. 一句话总结给 agent

读真实文件 → 把黑名单改成第 4 节那 8 项（去风控、补合同审查、确认纯文件名删除逻辑无 hash 残留）→ `cargo test skill_installer` 验证 → 报告 diff 与测试结果，等用户确认再提交。
