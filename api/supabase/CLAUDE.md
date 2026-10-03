# api/supabase/
> L2 | 父级: ../CLAUDE.md

成员清单
billing-variable-rate.sql: 支付普通汇率切换；为旧 Invoice 留下固定汇率快照，新购买只复用同策略订单，保留旧订单幂等和迟到付款；Staging 已应用 20261003092113，生产未应用。
billing-payments.sql: 新增受限服务角色、环境绑定、统一订单/审计、购买账本/钱包/周期/用量收据和 INVOKER 原子函数；本地 PostgreSQL/PostgREST 已验；20261003063924 已部署 Staging 并绑定正式供应商，生产支付库未部署。
CLAUDE.md: 记录 Supabase 数据库契约层职责与文档协议
profiles.sql: 建立只含 id/email/username/avatar_url/bio 的 public.profiles；username 是可修改、非唯一的单一展示名称，身份仍由 UUID 与 owner-only RLS 决定
avatars.sql: 建立公开读取 avatars bucket、5MB/JPEG-PNG-WebP 上传限制，以及绑定用户 UUID 目录与 owner_id 的 SELECT/INSERT/DELETE policies
memos.sql: 建立 memo_nodes 邻接树与 memos 正文表，以 deleted_at+deleted_root_id 表达删除批次、父子/正文物理级联，并提供 SECURITY INVOKER 的递归软删/恢复/永久删/当前用户清空 RPC、克制索引及 owner-only RLS/grants
memo-naming.sql: 命名边界契约；提供全库唯一的 memo_title_norm 规范化（首尾空白、连续空白折叠、拉丁大小写），按 (user_id, parent_id, node_type, 规范化 title) 建立两条排除 deleted_at 的 partial 唯一索引（根节点单独一条，因为普通唯一索引对 NULL 不去重）。第三节以两条 drop 收走曾让默认 Canvas 标题跟随来源笔记、并把独立改名回落的 sync/anchor 触发器——两种 Canvas 从此共用一条命名规则，血缘由 canvases.origin_node_id 与画布上那张 memo_ref 卡片表达而不由标题表达。改动 memo_title_norm 必须 REINDEX，索引表达式引用了它。文件末尾留档三次一次性存量处置：解开三处唯一冲突（3 行）、默认 Canvas 标题收敛（12 行）与放开命名（无 DML），并记下三条对应 migration 的 version 与「应用层与 drop 必须同进同退」的配对告警——本仓库没有独立部署说明文件，SQL 末尾这一段就是「远端已执行什么」的唯一留档位置
memo-search.sql: 建立 memo 标题/正文的 PGroonga 索引与 search_memos_hybrid 混合召回 RPC；取代 PostgREST ilike 全表匹配，并提供 search_memos_keyword 关键词入口。相似召回以 PGroonga `&@*`（给一段文档找相似行）走标题/正文两路，加结构邻近通道按 RRF 名次融合（k=60 为文献常数，非可调参数）；`&@` 是单关键词语义，对整段查询恒不命中，且 `&@*` 只在索引扫描下可用，故两路词面必须直接打在索引表上——二者均在真实库验证，join memo_nodes 排除回收站正文，正文永不进入返回载荷；关系通道预留待 memo_relations 落地后启用。本文件显式 create extension pgroonga，因该扩展在目标库可用但未安装
knowledge-canvas.sql: Canvas V1 基础 schema，建立 memo_nodes 中的 canvas 身份以及 canvases/canvas_nodes/canvas_edges/memo_relations、触发器、索引和 owner-only RLS；V2 在其上加法扩展，故此文件继续是全新环境的前置部署输入，不代表当前运行时协议
knowledge-canvas-rpc.sql: Canvas V1 的 save/read/layout/promote SECURITY INVOKER 定义，保留用于从旧 checkpoint 重建或显式回滚；V2 cutover 已撤销三个旧写函数的 authenticated 执行权，运行时不得调用
canvas-v2-schema.sql: 在不改 Canvas node_id 身份且保留旧列/旧 RPC 回滚面的前提下，加法扩展 canvas_kind/version、节点快照/尺寸/同 Canvas 引用、无向边唯一性、语料版本、expansion checkpoint 与 mutation receipt；完整 memo 写入/语义变化在同一事务推进 corpus，硬删前由触发器冻结最后可见快照
canvas-v2-entry-rpc.sql: Canvas V2 的持久入口与只读投影；按源 memo 行锁并发幂等 get-or-create 默认 Canvas（标题只在出生这一刻抄一份来源笔记名作初值，不带任何系统后缀，此后归用户），创建空白 standalone，读取不含 content_mdx 的完整图并恢复空间文字 text_scale，且只向 Chat 暴露可信 source/corpus/checkpoint/邻居上下文
canvas-v2-mutation-rpc.sql: Canvas V2 唯一 mutation 内核；人工 PATCH 与 AI expansion 共用行锁、base_version、稳定 intent digest、30 天 receipt、无节点硬上限的写入、关系容量/同图端点/稳定 UUID 校验及原子 checkpoint，空间文字宽高与 text_scale（0.25–8）也在同一 RPC 内校验并写入，任何失败不留下部分节点、边或版本
canvas-v2-index-fix.sql: 为同 Canvas 边端点、receipt 归属与旧目标单列外键补齐前导列完全匹配的覆盖索引，消除 V2 迁移新增的数据库 advisor 外键告警
canvas-v2-cutover.sql: V2 切流事务；核对单一 Canvas 身份、重复引用/边与跨租户不变量后，撤销 authenticated 对三个旧写 RPC 的执行权，只开放 V2 入口/读取/统一 mutation/context
canvas-v2-rollback-grants.sql: 代码回滚到 4c89827 一类旧 checkpoint 时人工执行的权限配套脚本；只恢复旧 save/layout/promote 执行权，不改业务数据，正常 V2 部署绝不执行
seed-dev-corpus.sql: 仅开发态语料种子，先清空目标用户全部备忘录再灌入 6 个主题簇的手写中文笔记；刻意布置「有字面重合」与「零字面重合但同义」两类关联对，使词面通道与语义通道的召回质量可被分别度量；它的消费者是 chat/src/evals/explore-v1，那 36 条金标准直接引用此处的标题。分步插入而非单语句 CTE，因 memos 的校验触发器读的是语句快照
ai.sql: 建立不含归档状态的会话、原始 UIMessage parts、会话级 memo 引用、整理 Run 与可逆 Action；以 owner-only RLS、显式 authenticated grants、引用上限触发器和受控 mutation policy 隔离租户与写入口
remove-ai-thread-archive.sql: 一次性删除 public.ai_threads.status 与旧归档索引；保留历史会话并创建按活动时间排序的新索引
ai-organize.sql: 提供 Run 创建/规划/失败/拒绝状态机和 SECURITY INVOKER 的 apply/undo 原子执行器；固定锁顺序、revision 门禁、真实目录复核、动作倒序恢复与幂等结果共同保护 AI 写操作
ai-organize-grants.sql: 收口 AI 整理六个 SECURITY INVOKER 函数的显式权限；撤销 public/anon/service_role 默认执行权，只向 authenticated 开放 Run 状态机入口
ai-v2.sql: 新环境默认完全访问的账号级 ai_user_settings 与通用 ai_commands 台账契约，以 owner-only RLS、幂等键、状态/操作/revision 约束及显式 grants 分离审批偏好和写审计事实
ai-settings-full-access.sql: 现有环境升级为默认完全访问；迁移 created_at=updated_at 的旧 ask 默认，保留明确选择，仅替换命令缺失设置时的默认片段以保留环境 GUC；2026-09-27 已应用并复核 Folune-staging，生产未应用
ai-command.sql: 已部署的 SECURITY INVOKER Command 创建/批准/拒绝/apply/undo 状态机；按账号权限校验审批来源，删除/恢复先按 ID 锁整树再锁目标，避免并发删除交叉等待；保留 expected_revision/owner/撤销门禁，失败保留目标快照并区分死锁/序列化/锁超时

ai-command-lock-order.sql: 已部署函数的增量升级补丁，只替换删除/恢复锁顺序和错误分类，保留远端 mutation GUC 与 RLS 契约；20260924040636 已应用到 Folune-staging

ai-usage.sql: 建立每用户每日 token 计数表 ai_usage_daily（user_id+usage_date 复合主键、total_tokens 只增）；写口经 folune.ai_usage_mutation 会话 GUC 收口加 owner-only RLS，唯一落账路径是 increment_ai_usage_daily 这一 SECURITY INVOKER 原子累加 RPC（日期服务端派生、只增不减），使用户无法经直接 PostgREST 写清零用量绕过限流，SELECT 仅供服务端与前端读今日额度；migration 20260927092934 已应用到 Folune-staging，2026-10-03 已以20261002173654/ai_usage_daily_quota应用到Folune-production并复核RLS/执行权限
billing.sql: 最小 billing_subscriptions 付款事实契约；用户仅获本人公开列 SELECT，平台标识不可读且运行时角色无订阅写权限，没有付款验证时保持空表；migration 20260929113054 已于 2026-09-29 应用并实测 Folune-staging，2026-10-03生产以20261002173658/billing_readonly_subscriptions应用并复核列级读与禁止写权限；网关验签/幂等落账待支付接入

职责: 保存可审阅、可顺序部署的 Database/Storage SQL 契约；画布沿用备忘录树而不新建第二套结构；重名的最终裁决在唯一索引而非应用层预检查；业务表以 owner-only RLS 与显式 grants 隔离租户，AI 方案只经受控状态机和单事务执行器落地，远端是否已部署必须单独验证，禁止把仓库文件存在误报为线上已应用。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
