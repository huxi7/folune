# app/src/shared/api/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 定义浏览器业务 API 边界、依赖方向与文档回环协议
access-token.ts: 无环境副作用的长会话鉴权决策层，优先当前认证会话，只在无会话时回退显式 access token 快照
client.ts: 唯一后端 HTTP 中枢，以 access-token 策略请求期读取可自动刷新的当前认证会话，统一注入 Bearer、透传 AbortSignal、区分 JSON/FormData、解析信封并收敛错误
client.test.ts: 长会话鉴权回归门禁，锁定刷新后的 session token 覆盖路由旧快照且显式 token 只作无会话兜底
ai.ts: AI Native V2 HTTP/消息边界，定义 SuperNoteUIMessage 冻结 context metadata，并集中暴露无归档状态的 Thread/Message 同步/Reference、账号权限、Command create/get/undo 与 Run 命令
ai-messages.test.ts: 审批消息同步 HTTP 契约测试，锁定 approval-responded 通过认证 PUT 原样写回 thread messages
ai-settings.test.ts: 审批设置 HTTP 契约测试，锁定 GET/PATCH 路径、Bearer、body、后端确认模式与失败拒绝语义
memo.ts: 与后端 snake_case 同构的备忘录领域/API 边界，区分不含正文的 active tree summary、单篇 MemoDetail 与正文关键词命中摘要，并集中暴露显式 access token 的 CRUD/搜索/回收站命令
memo.mapper.ts: 无副作用 DTO 适配层，把 PostgREST 数字 sort_order 归一为 Store 字符串，并分别收敛轻量 active tree、完整单篇正文与 Trash 响应字段
memo.test.ts: DTO 纯映射回归测试，验证 Trash 最小契约、恢复 subtree 排序归一及正文只存在于 detail 契约
canvas.ts: Canvas V2 唯一 HTTP 边界；定义 protocol 2 身份/节点/边/operation/receipt/context，提供 memo 默认入口、standalone 创建、无正文图读取、空间文字 text_scale、人工/AI 统一 mutation 与 48KiB pagehide keepalive；accessToken 可省，省略时请求期读取当前会话
profile.ts: 五字段 profile 业务 API 边界，以非空 username 统一展示名称、限制 username/bio PATCH，并以 multipart 调用后端头像替换接口

职责: 所有非认证业务网络请求必须从此目录进入后端；UI 禁止裸写 fetch，Supabase SDK 只存在于相邻 supabase/ 认证边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
