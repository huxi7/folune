# api/src/service/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务服务层职责与文档协议
auth.service.ts: 将 router 提取的用户 access token 转换为经 Supabase Auth 校验的可信 AuthUser；只在途合并同一 token，完成后立即释放，不形成撤销延迟窗口
health.service.ts: 提供不依赖 Hono Context 的健康状态用例
memo-tree.service.ts: 以内存邻接表把节点、正文摘要与画布身份组装为轻量 active tree/detached restored subtree，并集中转换 summary/detail，禁止 tree 重新携带 content_mdx
memo.service.ts: 是 nextSortOrder 与 memoContentData 两条派生规则的所有者；同一 owner 下彼此独立的 tree 节点/摘要与单篇节点/正文读取并发启动，消除首屏和首次切换的 PostgREST 瀑布；编排轻量 tree（含只在存在 canvas 节点时才补一次的画布身份读取）、关键词命中摘要、带命中通道与融合名次的相似候选、单篇 detail CRUD、父类型/防环规则与正文派生统计；树组装委托 memo-tree.service，两个检索 RPC 的 status 在此收敛为稳定 HTTP 错误，且相似候选只出摘录不出正文。命名规则在此落地：新建对象的系统默认名撞同级同类型时顺位让开，用户亲手输入的名字撞名只翻译成 409 MEMO_TITLE_CONFLICT；PATCH /memos 固定先写正文后写标题，使重名只挂起 title 而不连坐正文 正文替换只先读取 owner/type 节点，再写入新正文，避免自动保存下载即将被覆盖的旧正文；只改标题仍读完整详情。
memo-trash.service.ts: 回收站业务规则层，筛选已删除祖先下不可见的删除根、生成原路径/摘要，并把软删、恢复、永久删除、清空 RPC 状态映射为稳定 404/409
ai-thread.service.ts: 编排无归档分支的会话 CRUD、消息完整同步、旧 context snapshot 保留、仅首次用户文本自动标题及最多五篇去重引用；详情与引用都以 owner 过滤并发读取，避免会话切换多等一段 PostgREST 往返
ai-context.service.ts: 从服务端 memo tree/正文解析本轮冻结 primary/显式/置顶引用，先以 expected revision 拒绝审批续写期间的漂移，再生成可信路径并分配 60k 字符预算
ai-command.service.ts: 编排默认“每次询问”的账号权限 GET/PATCH 确认式更新，以及通用命令查询、创建、人工批准/拒绝与冲突安全撤销；Postgres 状态统一映射 404/409
ai-run.service.ts: 将 Run 创建/读取/记录方案/应用/拒绝/失败/撤销命令映射到数据库状态机，apply/undo 只接收 runId 并输出稳定 404/409
canvas.service.ts: 将 Canvas V2 默认/standalone 入口、读取、人工 mutation、AI expansion commit/context 编排为稳定 HTTP 契约；新建 standalone 的系统默认名撞名时与新建备忘录同规则顺位让开，409 回传当前 version/mutation_id 供 WAL rebase，运行期只有这一套写路径
profile.service.ts: 以 Web Crypto 生成单一默认 username 与头像 UUID 路径，执行幂等建档、owner 校验、5MB/JPEG-PNG-WebP 签名验证、avatar_url CAS、失败补偿与旧 Storage 对象清理

职责: 业务编排与权限判断层；禁止依赖 Hono Context，数据访问通过 repository，token 禁止记录、返回或持久化。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
