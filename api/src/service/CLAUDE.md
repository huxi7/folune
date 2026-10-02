# api/src/service/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务服务层职责与文档协议
auth.service.ts: 将 router 提取的用户 access token 转换为经 Supabase Auth 校验的可信 AuthUser；在途按原始 token 合并同一校验，已完成身份按 SHA-256(token) 键入 45 秒 TTL 缓存，原始 token 不越过请求生命周期；只缓存成功身份，401/502 永不入缓存，撤销延迟窗口上限等于 TTL
health.service.ts: 提供不依赖 Hono Context 的健康状态用例
memo-tree.service.ts: 以内存邻接表把节点、正文摘要与画布身份组装为轻量 active tree/detached restored subtree，并集中转换 summary/detail，禁止 tree 重新携带 content_mdx
memo.service.ts: 是 nextSortOrder 与 memoContentData 两条派生规则的所有者；同一 owner 下彼此独立的 tree 节点/摘要与单篇节点/正文读取并发启动，消除首屏和首次切换的 PostgREST 瀑布；编排轻量 tree（含只在存在 canvas 节点时才补一次的画布身份读取）、关键词命中摘要、带命中通道与融合名次的相似候选、单篇 detail CRUD、父类型/防环规则与正文派生统计；树组装委托 memo-tree.service，两个检索 RPC 的 status 在此收敛为稳定 HTTP 错误，且相似候选只出摘录不出正文。命名规则在此落地：新建备忘录复用客户端完整默认名，无编号请求/撞名按同级现存最大编号加一，不填空号，用户亲手输入的名字撞名只翻译成 409 MEMO_TITLE_CONFLICT；PATCH /memos 固定先写正文后写标题，使重名只挂起 title 而不连坐正文 正文替换只先读取 owner/type 节点，再写入新正文，避免自动保存下载即将被覆盖的旧正文；只改标题仍读完整详情。
memo-trash.service.ts: 回收站业务规则层，筛选已删除祖先下不可见的删除根、生成原路径/摘要，并把软删、恢复、永久删除、清空 RPC 状态映射为稳定 404/409
ai-thread.service.ts: prepare 的历史读取与 thread/settings/context 同一 Promise.all 接管失败，避免历史先拒绝导致 unhandled rejection；编排无归档分支的会话 CRUD、首开 bootstrap、切换 content 的 thread/ref/messages 并发读取、一次性 Chat turn prepare、增量消息/assistant 定点同步、旧 context snapshot 保留与最多五篇去重引用；非关键 thread 活跃时间后台更新
ai-context.service.ts: 无引用普通聊天不读取文件树/正文/会话引用，显式冻结引用不再重读会话引用；从服务端 memo tree/正文解析本轮冻结 primary/显式/置顶引用，先以 expected revision 拒绝审批续写期间的漂移，再生成可信路径并分配 60k 字符预算；prepare-chat 可与 thread/settings 校验并行启动
ai-command.service.ts: 编排默认完全访问的账号权限 GET/PATCH；首次读取只补缺失行、冲突重读胜出选择，不能覆盖并发 PATCH；另负责命令创建/查询/批准/拒绝/撤销及 Postgres 404/409 映射
ai-run.service.ts: 将 Run 创建/读取/记录方案/应用/拒绝/失败/撤销命令映射到数据库状态机，apply/undo 只接收 runId 并输出稳定 404/409
ai-usage.service.ts: getAccountUsage 统一设置/订阅页和 Chat 门禁的 UTC 日 token 口径；从 subscriptionService 获取可信付费权益，使用同一上限与真实累计值；recordUsage 只增不减并按当前 UTC 日重读，避免跨午夜误标日期
billing.service.ts: 组装公共套餐/积分包目录及有效订阅/真实日额度，10,000 token 确定换算 1 积分；选购只从服务器选价，积分 preview 在支付适配前封闭，不产生订单或购买余额
subscription.service.ts: 只认本人已确认付款事实，active 且处于有效期才赋予对应套餐额度；欠费、到期、取消或未来周期回落 Free，资料 metadata 不参与授权
canvas.service.ts: 将 Canvas V2 默认/standalone 入口、读取、人工 mutation、AI expansion commit/context 编排为稳定 HTTP 契约；新建 standalone 的系统默认名撞名时与新建备忘录同规则顺位让开，409 回传当前 version/mutation_id 供 WAL rebase，运行期只有这一套写路径
profile.service.ts: 以 Web Crypto 生成单一默认 username 与头像 UUID 路径，执行幂等建档、owner 校验、5MB/JPEG-PNG-WebP 签名验证、avatar_url CAS、失败补偿与旧 Storage 对象清理

职责: 业务编排与权限判断层；禁止依赖 Hono Context，数据访问通过 repository，token 禁止记录、返回或持久化。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
