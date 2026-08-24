# api/supabase/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Supabase 数据库契约层职责与文档协议
profiles.sql: 建立只含 id/email/username/avatar_url/bio 的 public.profiles；username 是可修改、非唯一的单一展示名称，身份仍由 UUID 与 owner-only RLS 决定
avatars.sql: 建立公开读取 avatars bucket、5MB/JPEG-PNG-WebP 上传限制，以及绑定用户 UUID 目录与 owner_id 的 SELECT/INSERT/DELETE policies
memos.sql: 建立 memo_nodes 邻接树与 memos 正文表，以 deleted_at+deleted_root_id 表达删除批次、父子/正文物理级联，并提供 SECURITY INVOKER 的递归软删/恢复/永久删/当前用户清空 RPC、克制索引及 owner-only RLS/grants
memo-search.sql: 建立 memo 标题/正文的 PGroonga 索引与 search_memos_hybrid 混合召回 RPC；取代 PostgREST ilike 全表匹配，并提供 search_memos_keyword 关键词入口。相似召回以 PGroonga `&@*`（给一段文档找相似行）走标题/正文两路，加结构邻近通道按 RRF 名次融合（k=60 为文献常数，非可调参数）；`&@` 是单关键词语义，对整段查询恒不命中，且 `&@*` 只在索引扫描下可用，故两路词面必须直接打在索引表上——二者均在真实库验证，join memo_nodes 排除回收站正文，正文永不进入返回载荷；关系通道预留待 memo_relations 落地后启用。本文件显式 create extension pgroonga，因该扩展在目标库可用但未安装
knowledge-canvas.sql: 把 memo_nodes.node_type 扩为含 'canvas'，并建立 canvases/canvas_nodes/canvas_edges/memo_relations 四张表、校验触发器、克制索引与 owner-only RLS。画布不是第二套树: 它就是一行 node_type='canvas' 的 memo_nodes，因此侧边栏并列、软删除、递归恢复、拖拽排序与 revision 乐观锁全部白拿。canvas_nodes.target_node_id 刻意用简单外键 + on delete set null 留墓碑（复合外键会把 user_id 一起置空），同租户校验因此交给触发器；卡片只允许引用 memo，因为画布卡片永不原地展开、只跳转，深度恒为 1
knowledge-canvas-rpc.sql: 提供 save_exploration_canvas/read_canvas/update_canvas_layout/promote_canvas_node 四个 SECURITY INVOKER RPC 与显式 grants，须在 knowledge-canvas.sql 之后部署。二者已于 2026-08-24 经 MCP 迁移应用到 SuperNote-staging（迁移名 knowledge_canvas_*），并以只读查询核对过约束/索引/触发器/16 条策略/grants 与函数 ACL；后续任何改动仍须单独验证远端。表可被 PostgREST 直接读，但凡「多张表必须一起成立」的动作只走这里: 保存要么四张表齐备要么当没发生；晋升在同一事务内建笔记并把 canvas_nodes.text 置空、kind 改成 memo_ref，内容只剩一份，重放则幂等返回 already_promoted；摘要/字数/sort_order 由 service 派生后传入，那些规则的所有者不在数据库
seed-dev-corpus.sql: 仅开发态语料种子，先清空目标用户全部备忘录再灌入 6 个主题簇的手写中文笔记；刻意布置「有字面重合」与「零字面重合但同义」两类关联对，使词面通道与语义通道的召回质量可被分别度量；它的消费者是 chat/src/evals/explore-v1，那 36 条金标准直接引用此处的标题。分步插入而非单语句 CTE，因 memos 的校验触发器读的是语句快照
ai.sql: 建立不含归档状态的会话、原始 UIMessage parts、会话级 memo 引用、整理 Run 与可逆 Action；以 owner-only RLS、显式 authenticated grants、引用上限触发器和受控 mutation policy 隔离租户与写入口
remove-ai-thread-archive.sql: 一次性删除 public.ai_threads.status 与旧归档索引；保留历史会话并创建按活动时间排序的新索引
ai-organize.sql: 提供 Run 创建/规划/失败/拒绝状态机和 SECURITY INVOKER 的 apply/undo 原子执行器；固定锁顺序、revision 门禁、真实目录复核、动作倒序恢复与幂等结果共同保护 AI 写操作
ai-organize-grants.sql: 收口 AI 整理六个 SECURITY INVOKER 函数的显式权限；撤销 public/anon/service_role 默认执行权，只向 authenticated 开放 Run 状态机入口
ai-v2.sql: 已部署的默认 ask 账号级 ai_user_settings 与通用 ai_commands 台账契约，以 owner-only RLS、幂等键、状态/操作/revision 约束及显式 grants 分离审批偏好和写审计事实
ai-command.sql: 已部署的 SECURITY INVOKER Command 创建/批准/拒绝/apply/undo 状态机；按账号权限校验审批来源，并以固定锁、expected_revision、软删除与撤销冲突保护真实 memo 写入

职责: 保存可审阅、可顺序部署的 Database/Storage SQL 契约；画布沿用备忘录树而不新建第二套结构；业务表以 owner-only RLS 与显式 grants 隔离租户，AI 方案只经受控状态机和单事务执行器落地，远端是否已部署必须单独验证，禁止把仓库文件存在误报为线上已应用。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
