# Folune 桌面端

Electron + Electron Forge，支持 macOS Apple Silicon arm64 与 Windows x64。桌面复用登录页、认证服务与工作区；不挂载官网导航、公告、Footer、Landing、博客或动态页面。Google 授权、条款与隐私政策在系统浏览器打开。API、Chat、Supabase 始终留在云端，安装包不含后端。

## 日常操作

首次在仓库根执行：

```sh
bun install --cwd app --frozen-lockfile
npm run electron:install
```

开发：

```sh
npm run electron:dev
```

自动启动 Vite（10000）与 Electron；已有 Vite 时复用。源码保存后热更新。菜单 View → Toggle Developer Tools 打开开发者工具。读取 `app/.env.local`，默认 API/Chat 为 localhost:10001/10002；本地后端仍用项目已有 Docker Compose 启动。

本机打包测试：

```sh
npm run electron:make
```

Mac 产物在 `desktop/release/folune-macos-arm64.dmg`，应用在 `desktop/out/Folune-darwin-arm64/Folune.app`。Windows 本机或 Actions 生成 `folune-windows-x64.exe`、`RELEASES`、版本化 `*-full.nupkg`。不要跨平台手工打包。

本地打包沿用当前公开环境配置，因此默认是开发服务/Staging；正式 Actions 显式注入 Production 变量。安装包不得包含 `.env`、Management Token、service role 或供应商密钥。工具链锁定 Electron、Forge 与 Node 24；安装时自动对齐 DMG 原生依赖的 Node ABI。

## 发布前的一次性配置

源码仓库 `solink7/folune` 保持私有；公开的 `solink7/folune-releases` 只接收二进制与更新元数据。

在私有源码仓库 Actions Variables 设置以下四项公开连接信息：

- `VITE_API_BASE_URL`
- `VITE_CHAT_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

这些变量已按当前 Cloud Run Production 配置写入。跨仓库发布另外需要 `FOLUNE_RELEASE_TOKEN` Actions Secret：建议使用仅能写入 `folune-releases` 的 fine-grained token，授予 Contents read/write。默认 `GITHUB_TOKEN` 不能写另一个仓库。不要将 token 填入 Vite 变量或提交文件。

Supabase 的 **Additional Redirect URLs** 需保留 Web 原有地址，并增加：

- Staging：`http://127.0.0.1:10003/auth/callback**`，用于源码开发时的本机回调。
- Staging 与 Production：`folune://auth/callback**`，用于安装版系统协议回调。

尾部通配符只允许该回调路径后的随机事务参数，应用自身仍校验完整路径和随机 state。当前插件没有 Auth config 读写工具，此白名单尚未配置/验证，不能把 Google 登录视为已完成。邮箱密码/验证码继续复用现有流程。

API 的 `CORS_ORIGINS`、Chat 的 `ALLOWED_ORIGINS` 需保留 Web 来源并加入 `folune-app://app`。Production 已配置并通过 OPTIONS 验证；若本地 DMG 连接开发服务，本机 `.env` 也需增加此来源并重启服务。

## v1.2.1

桌面内置前端与宿主白名单支持 `custom:github`。
GitHub 仅按已验证主邮箱匹配或建号。
旧安装包需升级，网页发布不会替换内置前端。
双平台安装包由稳定 Tag 触发 Actions 构建。

## 正式发版

先将已验证代码提交并推到源码仓库，再执行：

```sh
git tag -a v1.2.1 -m "Folune v1.2.1"
git push origin v1.2.1
```

Tag 必须为稳定的 `vX.Y.Z`；CI 将版本写进桌面包，两平台都成功后才创建/补齐草稿 Release，上传全部文件后一次公开。已公开版本不能被重新覆盖，修复须用新 Tag。手动运行 workflow 和 PR 只生成 Actions artifacts，不公开发布。

官网长期使用：

- https://github.com/solink7/folune-releases/releases/latest/download/folune-macos-arm64.dmg
- https://github.com/solink7/folune-releases/releases/latest/download/folune-windows-x64.exe

首个正式 Release 发布前，这两个链接会返回 404；创建仓库或生成本机 DMG 不等于下载已上线。网页下载按钮可靠判断系统/架构后直接下载，无法可靠判断时显示版本选择。

## 更新与安全边界

Windows 使用 Electron 原生 Squirrel `autoUpdater`，先读取最新稳定 Release，再固定到该 Tag 的更新目录，后台下载完整 nupkg。下载完成后用现有 Toast 提示「新版本已经准备好」，提供「稍后 / 重启更新」。RELEASES 和 nupkg 必须保留原名、同一版本同时发布。

Mac 不启用依赖签名的自动安装；发现新版本后用 Toast 提供「稍后 / 下载更新」，由用户下载 DMG 覆盖安装。网络失败或没有新版本时静默。开发态不检查更新。

退出/重启先等待现有笔记 flush 和 Canvas 保存门禁，失败保持应用打开。未关闭应用时保持同一窗口与会话；外链只允许 http/https/mailto。安装版使用固定标准安全协议来源，启用 sandbox/contextIsolation，关闭 Node 集成与 webview，IPC 校验主窗口顶层发送者。CSP 只允许构建脚本与已配置的后端来源，内联首绘脚本按内容哈希授权。

当前不购买签名证书，接受系统对未签名应用的提醒。Forge 保留 `APPLE_SIGN_IDENTITY`、`APPLE_ID`、`APPLE_APP_PASSWORD`、`APPLE_TEAM_ID`、`WINDOWS_CERTIFICATE_FILE`、`WINDOWS_CERTIFICATE_PASSWORD` 接口；以后 CI 安全导入证书并传入这些环境变量即可启用，证书不得进入源码。

## 验证范围

本地已验证开发窗口启动、macOS arm64 应用/DMG 构建、安装包独立登录页、Node 隔离、IPC、localStorage/IndexedDB、平台判断与 Toast 生命周期。Windows 安装/跨版本重启更新须在 Windows 上验证；Google 授权完整往返需要白名单配置和真实账号登录。Release/latest 链路需首个正式版本发布后验证。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
