# Folune

AI 自动归档的备忘录软件。记录想法，整理笔记，在知识画布中探索关联。

## 功能

- **随手记录**：Markdown 编辑与自动保存，支持复制正文和导出 `.md` 文件。
- **AI 协作**：围绕笔记问答、写作与改写，按主题命名和归档，支持审批与撤销。
- **知识画布**：组合笔记、文字与连线，借助 AI 发现笔记之间的关联。
- **画布问答**：围绕整张画布或指定笔记提问，在回复中查看原文引用。
- **多端使用**：浏览器与桌面端共享云端笔记，支持中英文与明暗主题。

AI 在发送消息或主动触发整理、拓展时运行，自动保存不会调用模型。

## 桌面下载

支持 macOS Apple Silicon 与 Windows x64，使用时需要联网。

[下载 macOS 版](https://github.com/huxi7/folune/releases/latest/download/folune-macos-arm64.dmg) · [下载 Windows 版](https://github.com/huxi7/folune/releases/latest/download/folune-windows-x64.exe) · [全部版本](https://github.com/huxi7/folune/releases)

## 本地开发

需要 Bun 1.3.14、Docker（含 Compose）、Supabase 项目与 DeepSeek API Key。

克隆仓库，在根目录创建本地配置：

```sh
git clone https://github.com/huxi7/folune.git
cd folune
cp app/.env.example app/.env.local
cp api/.env.example api/.env
cp chat/.env.example chat/.env
```

三个模块使用同一 Supabase 项目的 URL 与 Publishable key。`DEEPSEEK_API_KEY` 仅填写在 `chat/.env`，当前模型固定为 DeepSeek V4 Flash。

首次运行前，需初始化数据库、Storage 与认证，参见 [数据库地图](api/supabase/CLAUDE.md) 与 [认证指南](app/AUTH_SETUP.md)。目前没有一键初始化脚本；SQL 目录包含历史、回滚与开发种子脚本，不能整目录执行。

本地环境文件已被 Git 忽略。`VITE_` 配置会进入浏览器，请勿填写服务端密钥。

配置完成后，在仓库根目录启动：

```sh
docker compose -f docker-compose.dev.yml up -d --build
bun install --cwd app --frozen-lockfile
bun run --cwd app dev
```

访问 [本地页面](http://localhost:10000)。Compose 会安装并启动 API（`10001`）与 Chat（`10002`）。

前端按 `Ctrl+C` 停止；后端使用 `docker compose -f docker-compose.dev.yml down` 停止。

## 构建

```sh
bun run --cwd app build
```

Web 产物位于 `app/dist/`，API 与 Chat 需独立部署。桌面开发与打包另需 Node.js 24，详见下方文档。

## 源码结构

| 目录 | 职责 |
| --- | --- |
| [`app/`](app/) | React 用户端、编辑器与知识画布 |
| [`api/`](api/) | 业务接口、权限校验与数据持久化 |
| [`chat/`](chat/) | AI 对话、审批与笔记整理 |
| [`desktop/`](desktop/) | Electron 桌面端，复用 Web 工作区 |
| [`deploy/`](deploy/) | 容器构建与部署配置 |
| [`scripts/`](scripts/) | 本地开发与运维脚本 |
| [`docs/`](docs/) | 产品约束与历史归档 |

## 文档

- [架构地图](CLAUDE.md)：技术栈与模块边界。
- [文档索引](docs/README.md)：产品约束、设计与历史决策。
- [部署指南](deploy/README.md)：环境配置与生产发布。
- [桌面指南](desktop/README.md)：开发、打包与更新。

## 许可证

本项目采用 [AGPL-3.0](LICENSE) 开源协议，允许商用、修改与再分发。分发本项目或其修改版，或通过网络提供修改版服务时，须按协议向使用者提供对应源码。

第三方依赖与素材遵循各自的许可证和署名要求。
