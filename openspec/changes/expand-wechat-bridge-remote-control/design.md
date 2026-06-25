# expand-wechat-bridge-remote-control Design

## Context

现有 `wx_bridge` 只调用 daemon `engine_send_message_sync`，并把 `accessMode` 固定为 `read-only`。这保证了安全，但无法满足用户通过手机控制电脑的目标。Daemon 侧已有 Claude access mode 映射、图片参数和 `thread_compact` RPC，可作为本 change 的执行底座。

## Decisions

### Decision 1: Bridge owns permission tiering

微信 transport 和 daemon 都不应该决定当前消息使用哪种电脑权限。`wx_bridge` 负责：

- classify user intent；
- select access mode directly from the current WeChat message；
- append audit entries without raw body.

### Decision 2: Three tiers map to explicit access modes

- Tier 1 `read_only`：目录、列表、读取、搜索、解释、图片分析；run with `accessMode=read-only`。
- Tier 2 `default`：创建/修改/移动文件、运行普通命令、打开应用、截图、发送本地文件；run with `accessMode=default`。
- Tier 3 `full_access`：删除、覆盖、安装依赖、git push/sync、网络上传、工作区外路径、系统级操作；run with `accessMode=full-access`。

`full-access` 只能由 bridge 分类出的 Tier 3 触发，不能由 daemon params 直接传入。

### Decision 3: Commands bypass the model where possible

Bridge-native commands are deterministic:

- `帮助` / `/help`：返回微信可用命令和权限提示。
- `新开会话` / `/new`：清除该 `wxid` 的 last Claude session。
- `会话压缩` / `/compact`：对当前 Claude session 调用 daemon `thread_compact`。
- `取消` / `/cancel`：返回当前没有可取消的二次确认；常规微信消息直接执行。

Regular task text still goes through Claude.

### Decision 4: Media protocol is implemented at bridge boundary first

The HTTP endpoint already accepts OpenAI multimodal content. This change keeps that contract and extends outgoing response shape to support text plus image/file refs for patched WeClaw. Project-managed WeClaw relays outbound images as media messages and outbound files as attachments.

## Risks / Trade-offs

- Intent classification is heuristic. The prompt tells Claude to execute only the user's explicit request and avoid expanding scope.
- `full-access` is powerful. The bridge keeps a narrow high-risk marker list and logs audit metadata, but no longer asks the user for a second WeChat confirmation.
- Real WeChat media/quote behavior still needs account-level smoke after process restart because WeChat polling state is external to local unit tests.

## Cross-layer Impact

- HTTP request/response: OpenAI chat completion remains compatible; patched transport can read assistant content parts for images and files.
- Daemon JSON-RPC: `engine_send_message_sync` gains variable `accessMode`; `thread_compact` is called for `/compact`.
- State: per-`wxid` session map is extended with reset support.
