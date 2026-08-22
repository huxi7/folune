# SuperNote 审计与修复台账

> 审计 2026-08-21 · 两轮修复截至 2026-08-22 · 当前源码约 37,500 行
>
> 判据来源: 根 `CLAUDE.md`、`app/CLAUDE.md`、`app/UI_REFINEMENT.md`、`app/brand-spec.md`、`~/.claude/CLAUDE.md`
>
> 审计方式: 机械底账建候选集 → 模块 × 视角独立盲扫 → 逐条对抗验证（存疑即毙，6 条候选被驳回）

**一句话判断**: 主干地基健康，目录/正文的关键性能耦合已拆开；现在不需要整库重构，后续可以在明确检索算法后独立建设混合检索与 Canvas。

仍需正视的生产风险只有两类：长期编辑 token 过期后的重新认证，以及人工多标签页写入的 revision 冲突体验。智能审批链属于不准备产品化的实验能力，风险接受见下文。

| 机械指标 | 结果 |
| --- | --- |
| L3 头部覆盖率 | **100%**（app/src + api/src + chat/src 零缺失） |
| 非 `index.css` 的 CSS 硬编码色值 | **0** |
| 裸 `fetch` 越界 / `as any` / `@ts-ignore` | **0 / 0 / 0** |
| 契约数值与文档吻合 | autosave 32/1500/8000 + 400/800/1600、Skeleton 180/360 全部吻合 |

**进度**: 本轮完成根因 4、根因 5 剩余部分、模式 A、模式 C 与根因 16 剩余项；审批实验风险接受，生产待办仅保留根因 7 与根因 11 门禁。
验证: App/Chat typecheck script 与 API 等价 `tsc --types bun-types` 通过，App 165 + API 77 + Chat 26 = **268 项测试通过**，App 生产构建通过。API 既有 `tsconfig types=["bun"]` 与已装 `bun-types` 名称不一致仍属于基线脚本问题，本轮未越界改配置；交互行为仍需人工点验。

---

## ✅ 已修复

### 数据安全与数据丢失

**根因 3 · Escape 无层级仲裁，误关等于草稿销毁**（🔴 高）
三个互不知情的视角独立撞到同一根因。`preventDefault` 只阻止浏览器默认行为，不阻止事件冒泡到 window，所以「内层先响应」不构成保护；而 Panel 是条件渲染（卸载）、Composer 草稿是纯本地 state，一次误触即不可恢复。
修复 — 上游 `PaperWorkspaceShell.tsx:111` 加双守卫（`event.defaultPrevented` + 焦点在可编辑元素内则让行）；内层 `Dialog.tsx`、`UserMenu.tsx`、`AppSidebar.tsx`（右键菜单 + 搜索框）、`ThreadHistory.tsx` 补 `preventDefault`。
> 审计报告称内层「只 preventDefault」，实际 `Dialog.tsx` 与 `UserMenu.tsx` **连 preventDefault 都没调** —— 光加上游守卫拦不住它们。

**根因 8 · page-exit flush 在保存在飞时提前 return，keepalive 从未发出**（🔴 高）
修复 — `useMemoAutosave.ts:222` 在飞分支遇 keepalive 语义时不再等待那个必随卸载而死的 promise，直接新建 keepalive 请求（由浏览器接管，能活过卸载）；`:292-303` 追赶链补发时保留 keepalive。

**根因 9 · treeGeneration 门禁把 id 身份映射连坐清掉**（🔴 高）
根因是把「id 身份记账」当成了 generation 作用域的视图状态，但节点身份能跨越整树重取。
修复 — `memoTreeStore.ts:288` 映射记录移出门禁（成功与失败两条路径都改），只有视觉 `set()` 仍受门禁。

**根因 13 · onFinish 自动执行写工具期间 busy 为假，会话可被卸载**（🟠 中高）
修复 — `AgentPanel.tsx` 新增 `clientToolsRunning` 并纳入 `busy`；经 `:414` 的 `onBusyChange` 守住会话历史 / 新对话 / ThreadHistory 三个卸载入口。

### 性能

**根因 5 · 正文草稿写进全局树，把单字段变更放大成全树重建**（🔴 高）
首轮修复 — `memoTree.ts:updateNode` 只克隆「根→目标」祖先路径，并为搜索/候选减少重复遍历。
本轮完成 — `memoTreeStore.ts` 只保存结构与摘要；新增 `memoDocumentStore.ts` 按 ID 缓存正文、草稿和 AI 正文投影。正文输入不再触发文件树订阅者，临时 ID 对账、删除清理、迟到响应门禁均有独立测试。

**根因 4 · tree 载荷把结构与正文耦合**（🔴 高）
修复 — `GET /memo-tree` 只查询/返回节点和正文摘要，不再拼接全部 node ID 的 `in.(...)` URL，也不返回 `content_mdx`；`GET /memos/:id` 保持单篇完整正文。用户打开笔记后，`useMemoDocumentLoad` 才按 ID 读取正文并缓存。

当前手动文件库搜索与 Composer `@` 搜索经 `GET /memo-search?q=` 在服务端匹配正文，只返回命中 ID 与摘要，再与轻量 tree 中的标题/路径结果合并。它只是保持现有关键词体验的轻量过渡，不代表未来 Agent 检索算法；向量化、分块、混合召回与排序仍留到单独设计。

Chat 整理同时读取轻量 tree 与目标 memo detail；客户端 AI `read_memo` 的 Worker 只验证并返回 nodeId，主线程再按 ID 读取完整正文。因此“网页不全量下载正文”和“AI 能读取明确目标正文”两条边界同时成立。

**根因 6 · AI 会话列表零 memo 边界，上游任意更新触发全量 Markdown 重解析**（🔴 高）
修复三处，缺一不生效 — `StreamingText.tsx:213` 的 `onProgress` 改 ref 移出 effect 依赖（语义回归「text 前进时通知」）；`AgentPanel.tsx` 回调 `scrollToLatestAuto` 稳定化；`ChatMessage.tsx` memo 化（react-markdown 无自身 memo 且在 render 内 parse，拦截必须在这一层）。

### 正确性与可访问性

| 根因 | 问题 | 修复位点 |
| --- | --- | --- |
| **10** 🔴 | abort 落在读 body 期间时 `response.json()` 抛的 AbortError 被吞成 `INVALID_API_RESPONSE`，调用方守卫全部失效 | `client.ts:42` body 消费重抛 AbortError |
| **12** 🟠 | localStorage 访问器本身会抛（阻止站点数据 / 配额满）→ `/app` 整页白屏；persist 在 reducer 内且早于 return，一次写入异常让开关连内存都不翻转 | `workspaceChromeStore.ts` 按 `ThemeProvider` 范式降级 + persist 移出 reducer |
| **14** 🟠 | 焦点陷阱写成「边界元素等值比较」，焦点停在 panel 容器或 body 时 Shift+Tab 穿出模态 | `Dialog.tsx:89` 改 `contains` 不变量 |
| **15** 🟠 | `--space-5` 未定义（阶梯跳过 5）致 Toast 图标槽塌陷 | `index.css:186` 补 `--space-5` |
| **16** 🟠 | MentionInput 删除正文中间 @token 时光标被弹到末尾 | 新增 `readCaretOffset`/`placeCaretAtOffset` 按纯文本偏移原位恢复（DOM 被 `replaceChildren` 重建，旧 Range 随节点失效，只有字符偏移跨重建稳定） |
| **16** 🟠 | Select 在 Safari/Firefox 点击不赋焦点 → 打开后键盘完全失控 | `openSelect` 显式聚焦 trigger |
| **16** 🟠 | UserMenu `closeAndRun` 先卸载再执行，`activeElement` 退回 body，下游 Dialog 无处归还焦点 | 先归还焦点再卸载 |
| **16** 🟠 | `hydrate()` 绕过 <1400px 互斥规则，窄屏刷新双 Panel 同开 | hydrate 恢复快照受窄屏互斥约束 |
| **11** 🟠 | `restoreTitle` 空 catch 使半写状态（标题已改、正文未改）永不可见 | 留不含身份信息的 `console.error`（门禁部分见下） |

### 系统性模式

**模式 B · 弹层「外部点击关闭」5 处各自手写，行为三向分叉**
分叉导致两条真实缺陷：`Select` 与 `PermissionModeControl` 无 Escape 关闭（键盘用户无退出路径）；`PermissionModeControl` 依赖数组是 `[]`，监听器整个挂载期常驻。
修复 — 新建 `app/src/shared/design-system/useDismissable.ts`，收敛「外部 pointerdown + Escape + 焦点归还」三件事。它同时是根因 3 层级仲裁协议的下半部分：每次消散都 `preventDefault`，使壳层守卫得以让行。

**模式 A · 图标尺寸契约已进入类型系统**
修复 — `icons.tsx` 导出受限 `IconProps`，业务图标只接受 14/16/20/24px；全库阶梯外数值已归一，后续写入 15/17/18 等尺寸会直接 typecheck 失败。

**模式 C · 800 行边界已清障**
修复 — 文件树 Skeleton、正文加载 hook 与全局浏览器基础 CSS 按职责拆出。当前最高的相关生产文件为 `AppDashboard.tsx` 794 行、`AppSidebar.tsx` 791 行、`landing.css` 779 行，其余审计列出的文件也均低于 800 行。此次只拆越线职责，没有整库重构。

**根因 16 · 剩余无障碍语义**（🟡）
修复 — Thinking 视觉文案与单一 live status 分离；隐藏 Skeleton 不再宣告 busy；无详情 ToolCall 使用不可聚焦 status；Assistant 正文不再伪造具名 landmark；UserMenu 退出失败改走全局 Toast。新增静态 DOM 语义回归测试。

### GEB 回环

- 本轮同步根 L1、app/api/chat 模块地图、所有受影响 L2 与职责变化的 L3；新增 `memoDocumentStore`、`useMemoDocumentLoad`、`useMemoSearch`、`MemoTreeSkeleton`、`memo-tree.service`、`global-base.css` 及测试均已登记
- 数据库 schema/RLS 未改；所有新查询继续显式携带已认证 JWT 与 `user_id`，tree/detail/search 契约在代码、测试和文档中同构
- `design-system/CLAUDE.md` 补 `useDismissable.ts` 成员条目
- `UI_REFINEMENT.md` 更正过期 Decision（「double-click never enters edit mode」与代码及 `app/CLAUDE.md` 矛盾），Log 追加裁决记录；2026-08-08 移除记录作为历史保留不动
- 删除 `app/src/shared/ui/` 与 `chat/src/mastra/public/` 两个空目录
  > 更正审计结论: 两份 L2 成员清单里**并未列出**这两个目录，报告的 `l2-stale` 判定不成立。真实情况是磁盘上存在两个 git 完全不追踪的幽灵目录。

**产品裁决（已定）**: 双击文件树行**进入重命名**，与代码及 `app/CLAUDE.md` 一致。`AppSidebar.commitRename` 补「标题未变则短路」，一处收敛双击 / F2 / 右键三条入口，消除多余 PATCH 与虚假成功 Toast。

---

## ⬜ 未修复

### 根因 1 + 2 · 审批链（实验功能，产品风险接受）

**裁决**: 不再投入跨服务审批协议重构。该能力仅视为实验，不作为 Canvas、检索或桌面版的生产依赖；若未来对外开放智能审批，必须重新审计并先关闭现有绕过路径。每次询问与完全访问的既有路径不因本轮扩张。

**问题**: 权限设为「智能审批」时，写工具的 `tool-input-available` 在审批裁决之前就到达浏览器。用户此刻点「停止生成」→ 文件夹被真实软删除，而台账写着「智能审批…后批准」—— **这次审批从未发生**。讽刺之处: 看到 AI 要删东西时，人的本能动作正是点「停止」，而这个动作本身就是触发条件。

影响面比表面更宽: `isDisconnect`/`isError` 走同一个 `finally`，网络抖动、chat 服务崩溃、容器重启全部触发。漏洞精确地只在 `auto_approve`（`ask` 模式偶然安全，`full_access` 是明示授权）。

根因 2 可分离: 任何能构造 HTTP 请求的客户端都可声称 `approval_source="approval_agent"`，api 全链路无一处校验审批是否真的发生过。即使修好根因 1 也依然存在。

> 现有缺口仍真实存在；“风险接受”不是“已修复”。生产化该实验前必须回到流转发与服务端可信审批证明两层一起解决，不能只补客户端 abort 判断。

### 根因 7 · 会话过期后 autosave 静默失败，无重新认证路径（🔴 高）

**为什么留**: 要改 `memo.ts`/`ai.ts`/`profile.ts` 共 30 个强制 `accessToken: string` 的签名，改动面大。

**问题**: 在 `/app` 写作超过 token 有效期且无路由导航（**对长期写作产品是常态**）→ 每轮 autosave 401，重试 3 次全失败，只弹「自动保存失败」，**无任何重新登录引导**。用户继续写，刷新全丢。`client.ts:74` 本就有能力实时取新 token，30 个调用点绕过它。

### 根因 11 门禁部分 · 人工写路径缺 revision 校验（🟠 中高）

**为什么留**: 卡在产品决策 —— 发现冲突后给用户看什么？覆盖、合并、还是另存？**没有这个决策，加检查只会把「静默覆盖」变成「报错且丢稿」，更糟。**

**问题**: 两标签页同时打开同一篇，autosave 自动触发 → 后写静默覆盖前写，无冲突提示。AI 路径有 revision 门禁 + 原子 RPC，人工路径两者都没有（`MEMO_UPDATE_CONFLICT` 只在行不存在时触发，不是版本冲突）。

基础设施已齐备: DB trigger 自增 revision，AI 路径已在用。改 `memo.dto.ts:121` 加 `expected_revision` + 服务层走单个原子 RPC 即可复用。本轮已修的是它的可观测性缺口。

---

## 建议顺序

1. **先做新功能设计，不整库重构** — 目录/正文地基已具备，Canvas 和 Agent 检索应各自立项。
2. **根因 7** — 在长时间写作进入真实用户验收前，统一 token 获取与重新认证路径。
3. **根因 11 门禁** — 先确定冲突时覆盖、合并或另存的产品行为，再接入 revision 原子写。
4. **Agent 检索单独设计** — 决定分块、关键词/向量召回、重排与引用预算后再实现；不要把正文重新放回 tree。
5. **智能审批实验** — 当前不继续；若要产品化，先按上文重新审计并关闭已知绕过。

---

## 附录 · 经对抗验证被驳回的候选（6 条）

留档以说明验证强度。

| 候选 | 驳回理由 |
| --- | --- |
| styles 三文件缺 `prefers-reduced-motion` | 当前由 `styles/global-base.css` 的全局 `!important` 兜底；且 `segmented-control.css` 只有颜色过渡、`sidebar-button.css` 的 1px 位移是判据明文允许的 press 反馈 |
| chat 对 LLM 输出裸 parse | `organize.ts` 有全局 catch，并把 planning Run 标记 failed。防护完整 |
| `role="treeitem"` 无合法父级 | `AppSidebar.tsx` 提供 `role="tree"`，子层提供 `role="group"`。ARIA 结构正确 |
| token 刷新触发重拉整树 | `accessToken` 来自 router loader 非状态订阅，后台刷新不更新 prop。**但反向暴露了根因 7** |
| 两处非空断言不安全 | `memoToolExecution.ts:104` read 分支已提前 return；`:57-58` 的 `plan.reference!` 在 reorder 分支必带 reference |
| `charsSinceFlush` 永不归零致 5-8 req/s | 事实对但因果链错: `savingPromise` 串行化把速率钉在 1/RTT。真根因是追赶链无速率下限，已并入根因 8 |

**方法缺陷自陈**: CSS 变量穷尽扫描（`comm -23`）初筛 10 个候选，逐条定型后 9 假 1 真 —— 首版正则只抓行首声明，漏了单行块内的定义。此类机械扫描必须配人工定型，不能直接当结论。
