# ppt-scheme-publish

桌面端把本地 PPT HTML 发布到 lawhub schemes，并打开 lawhub web 协作查看器。

## Requirement: lawhub 登录复用 web 凭据

桌面端 SHALL 用用户名/密码登录 lawhub（`POST /api/auth/login {username,password}`），拿到 JWT 后本地存储。owner_id 与 lawhub web 一致（`owner_id_for_username`），保证桌面端发布的方案在 web 端同一用户可见。

### Scenario: 登录成功存 token
- WHEN 用户在桌面端输入正确的 lawhub 用户名/密码
- THEN 客户端 POST `/api/auth/login`，收到 `{token,user}`，token 写入本地存储供后续发布带 Bearer

### Scenario: 凭据错误
- WHEN 用户名/密码错误
- THEN lawhub 返回 401，客户端抛出可展示的错误，不写 token

## Requirement: 发布本地 HTML 为 lawhub 方案

桌面端 SHALL 把选中的本地 HTML 文件以 `POST /api/schemes {title,html}`（带 Bearer）发布，得到 `scheme_id`，并据此生成 lawhub web 查看器 URL `${base}/schemes/{id}` 用系统浏览器打开。

### Scenario: 发布并打开协作查看器
- WHEN 已登录用户在 ppt 面板对某 HTML 点「发布到 lawhub」
- THEN 客户端上传 HTML，拿到 scheme_id，用 `open_workspace_in` 打开 `${base}/schemes/{id}`，进入协作批注

### Scenario: 未登录时发布
- WHEN 未登录（无 token）点发布
- THEN 客户端先要求登录，不发起未鉴权的发布请求
