# Chat 全链路性能优化验收

这份记录对应 2026-09-08 当前 checkout 的 Chat 性能改动。目标是减少用户能感知的等待，同时保持冻结 context、revision、审批、工具幂等与 API/RLS 事实边界不变。

## 链路基线

浏览器打开 Assistant Panel 后，`useAiThreads` 恢复 thread 列表、选中 thread detail、历史消息；发送由 `useChat` 经 `DefaultChatTransport` 进入 `chat/src/routes/chat.ts`，Chat 验证 JWT 后向 API 解析 memo context、权限和消息持久化，再交给 Mastra/DeepSeek 流式生成。工具结果回到浏览器 Worker，审批与 command 仍由 API 状态机裁决。

## 主要瓶颈

1. 面板冷启动在浏览器侧是列表、detail、messages 三个请求；缓存未命中时每个请求都重复鉴权与连接等待。
2. 普通发送每一轮都把完整历史消息从浏览器上传到 Chat；Chat 又先并发读取 thread/settings/context，再完整同步消息，模型启动前还有一次全量写入。
3. 每次流结束、工具结果和审批响应都上传整段消息；前端随后再次读取 detail、messages、threads，用户已经看到答案却仍被后台往返拖住。
4. 长会话的历史 Markdown 即使在视口外也参加布局和绘制，流式更新时会放大 React/Markdown 重算成本。

## 实际改动

- 新增 `GET /ai-threads/bootstrap`：一次返回 thread 列表、选中 detail 和消息；空账号仍只在真正打开面板时创建首个 thread。
- 新增 `POST /ai-context/prepare-chat`：在 API 内并发启动 thread、权限、历史（增量模式）和 memo context 读取；一次完成冻结 context、稳定 assistant 占位与消息入账。
- 普通发送改为只传最后一条 `message`；服务端从已持久化历史重建模型输入。重新生成仍保留完整 `messages` 以支持截断语义，工具/审批续写复用同一 assistant id。
- 新增 `PATCH /ai-threads/:threadId/messages/:messageId` 与定点 repository 写入。流末只等待当前 assistant 的小写入，响应只返回 `id/updated_at`，thread 活跃时间和自动标题移到非关键后台更新；增量首轮只写新增 user/assistant 行，不再全量 upsert。
- API 对 `ai-threads/*` 与 `ai-context/*` 开启 gzip/deflate 协商，长历史和冻结正文下载不再发送未压缩 JSON；SSE Chat 流保持原有流式通道，不被压缩中间件接管。
- 客户端在流完成后先用本地消息快照立即更新会话画面；错误或中止才后台重新校准服务端，避免成功路径再发 detail+messages+list 三次请求。
- `useChat` 使用 32ms 订阅节流；历史消息（最后一条除外）使用 `content-visibility: auto`，保留 DOM 与滚动语义，流式末尾仍完整测量。
- AgentPanel 工具命令对账首次挂载扫全量，后续只检查当前 assistant 的状态变化；文本分块不再重复扫描整段历史 parts。

## 可验证的改善

| 路径 | 修改前 | 修改后 |
| --- | --- | --- |
| 面板冷启动（无新鲜快照） | 浏览器 3 个 AI 请求：list + detail + messages | 1 个 bootstrap 请求 |
| 普通新消息请求体 | 完整 UIMessage 历史 | 1 条增量 message + 冻结 ID/revision |
| 流结束成功路径 | 全量消息 PUT + detail/messages/list 刷新 | 当前 assistant 一次小 PATCH + 本地快照 |
| 增量工具/审批续写入账 | 全量历史 upsert | 已有 assistant 定点 PATCH，或新增两行一次 upsert |
| Chat prepare 前置读取 | thread/settings/context 与同步逻辑分散 | 单 API 入口，thread/settings/history/context 并行启动 |
| AI 历史/上下文传输 | 未压缩 JSON | gzip/deflate 协商，保留 `Vary: Accept-Encoding` |
| 流式工具对账计算 | 每个分块扫描整段历史 parts | 首次全量恢复，后续只扫描末条 assistant |

API 内存集成测试还验证了首轮完整消息、增量续写、稳定 assistant 不重复、冻结 revision、owner 过滤和定点 PATCH。以上是协议级确定性差异，不把本地 mock 时间冒充真实 DeepSeek 端到端延迟百分比。

## 验证结果

- `app`: `508 pass / 0 fail`，`bun run typecheck`、`bun run lint`、`bun run build` 通过。
- `api`: `112 pass / 0 fail`，`bun run typecheck` 通过；新增 bootstrap、prepare-chat、增量写入与 assistant PATCH 覆盖。
- `chat`: `63 pass / 0 fail`，`bun run typecheck`、`bun run build` 通过。
- `git diff --check` 通过。
- 当前 Docker `api-dev`、`chat-dev` 健康探针均为 200；未认证请求仍在路由层返回 401，允许来源的 API 预检仍为 600 秒。

## 仍受架构/外部服务限制的部分

- Chat 入口仍需经过 Chat JWT 校验和 API JWT/RLS 校验；没有为了延迟而缓存已完成身份或绕过权限。流结束仍等待一次定点 assistant 写入，以避免切换会话时出现服务端落后本地的窗口。
- memo context 仍需从 API 读取 active tree 和选中正文；大树/超长正文的数据库、网络和模型 token 成本仍是上限，下一步若要继续应基于真实 Postgres 查询计划做定向 context RPC，而不是盲目缓存 revision。
- DeepSeek 首 token 延迟、模型排队、供应商网络和 Supabase 地理距离无法由前端代码消除；本次没有用假模型或开发态热缓存宣称端到端百分比。
- 重新生成必须保留完整历史以维护语义，长历史仍会产生模型上下文成本；`content-visibility` 只降低浏览器布局/绘制成本。
- Chat 服务当前 Mastra storage 仍是内存提示，持久事实在 API/数据库；服务重启恢复依赖 API 消息，不把内存 storage 当作可靠缓存。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
