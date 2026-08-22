# SuperNote 审计与修复台账

> 审计 2026-08-21 · 修复 2026-08-22 · 范围约 33,000 行 · 分支 `fix/audit-remediation`
>
> 判据来源: 根 `CLAUDE.md`、`app/CLAUDE.md`、`app/UI_REFINEMENT.md`、`app/brand-spec.md`、`~/.claude/CLAUDE.md`
>
> 审计方式: 机械底账建候选集 → 模块 × 视角独立盲扫 → 逐条对抗验证（存疑即毙，6 条候选被驳回）

**一句话判断**: 这不是一个腐烂的代码库，而是一个建了很好的基础设施、却在关键路径上绕过了自己基础设施的代码库。

`client.ts` 会自动续 token，30 个调用点绕过它；AI 写路径有原子 RPC + revision 门禁，人工写路径不用；`ThemeProvider` 有 localStorage 降级范式，`workspaceChromeStore` 不用；`icons.tsx` 收口了图标来源，没收口尺寸。

| 机械指标 | 结果 |
| --- | --- |
| L3 头部覆盖率 | **100%**（app/src + api/src + chat/src 零缺失） |
| 非 `index.css` 的 CSS 硬编码色值 | **0** |
| 裸 `fetch` 越界 / `as any` / `@ts-ignore` | **0 / 0 / 0** |
| 契约数值与文档吻合 | autosave 32/1500/8000 + 400/800/1600、Skeleton 180/360 全部吻合 |

**进度**: 16 条根因中 12 条已修 + 1 条部分修；3 个系统性模式中 1 个已修；3 条 GEB 漂移已清。
验证: app/api/chat 三处 typecheck 通过、235 测试通过、生产构建通过。交互行为需人工点验。

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
修复 — 上游 `memoTree.ts:updateNode` 剪枝：只克隆「根→目标」这一条祖先路径，未命中子树保持原引用，下游 memo 得以生效。**加两条不变量测试锁住剪枝行为**，防止重构退回 O(N)。
下游 — `AppSidebar.tsx:234` 搜索 `useMemo` 化（原先裸在 render body，任意 state 变化都触发全库全文扫描）；`MentionMenu.tsx` 惰性遍历 + 先裁剪再取 revision（原先每个候选一次全树查找）。

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

### GEB 回环

- `design-system/CLAUDE.md` 补 `useDismissable.ts` 成员条目
- `UI_REFINEMENT.md` 更正过期 Decision（「double-click never enters edit mode」与代码及 `app/CLAUDE.md` 矛盾），Log 追加裁决记录；2026-08-08 移除记录作为历史保留不动
- 删除 `app/src/shared/ui/` 与 `chat/src/mastra/public/` 两个空目录
  > 更正审计结论: 两份 L2 成员清单里**并未列出**这两个目录，报告的 `l2-stale` 判定不成立。真实情况是磁盘上存在两个 git 完全不追踪的幽灵目录。

**产品裁决（已定）**: 双击文件树行**进入重命名**，与代码及 `app/CLAUDE.md` 一致。`AppSidebar.commitRename` 补「标题未变则短路」，一处收敛双击 / F2 / 右键三条入口，消除多余 PATCH 与虚假成功 Toast。

---

## ⬜ 未修复

### 根因 1 + 2 · 审批链（🔴 极高，数据安全 + 审计完整性）

**为什么留**: 修复位点在 `chat/src/routes/chat.ts:296-320`，要把 `requireWriteApproval` 移进流转发路径，并引入 AI SDK 现成的 approval signature 传递到 api。这是跨服务的**协议改动**，不是几行代码；改错了比现状更糟（会让整套审批失效）。值得单独一轮。

**问题**: 权限设为「智能审批」时，写工具的 `tool-input-available` 在审批裁决之前就到达浏览器。用户此刻点「停止生成」→ 文件夹被真实软删除，而台账写着「智能审批…后批准」—— **这次审批从未发生**。讽刺之处: 看到 AI 要删东西时，人的本能动作正是点「停止」，而这个动作本身就是触发条件。

影响面比表面更宽: `isDisconnect`/`isError` 走同一个 `finally`，网络抖动、chat 服务崩溃、容器重启全部触发。漏洞精确地只在 `auto_approve`（`ask` 模式偶然安全，`full_access` 是明示授权）。

根因 2 可分离: 任何能构造 HTTP 请求的客户端都可声称 `approval_source="approval_agent"`，api 全链路无一处校验审批是否真的发生过。即使修好根因 1 也依然存在。

> ⚠️ 在 `AgentPanel.tsx:228` 加 `isAbort` 判断只能挡住 SDK 恰好暴露的三个标志，是症状层补丁 —— **别选它**。改上游一处，客户端闸门自动变正确，且覆盖 abort / disconnect / error / 刷新 / 崩溃全部终止路径。

### 根因 4 · tree 载荷把「结构」与「正文」耦合成不可分载荷（🔴 高）

**为什么留**: 契约层改动（tree 只返结构 + excerpt，正文按需单取），牵动 api model / service / repository / 前端搜索四层。是架构规划，不是修补。

**问题**: 笔记约 200 篇时，`in.(...)` 拼接的 UUID 列表撞 8KB 网关/PostgREST URL 上限 → `/memo-tree` 返回 431/414 → **应用完全打不开**。对「长期积累备忘录」的产品，200 篇是极低天花板。

修复上游 `api/src/model/memo.model.ts:37-40`，同时消解三个后果：URL 崩溃、载荷线性膨胀、客户端搜索被迫吃全文。**必须先于根因 5 的剩余部分**（正文草稿仍写进全局树这一半）。

### 根因 7 · 会话过期后 autosave 静默失败，无重新认证路径（🔴 高）

**为什么留**: 要改 `memo.ts`/`ai.ts`/`profile.ts` 共 30 个强制 `accessToken: string` 的签名，改动面大。

**问题**: 在 `/app` 写作超过 token 有效期且无路由导航（**对长期写作产品是常态**）→ 每轮 autosave 401，重试 3 次全失败，只弹「自动保存失败」，**无任何重新登录引导**。用户继续写，刷新全丢。`client.ts:74` 本就有能力实时取新 token，30 个调用点绕过它。

### 根因 11 门禁部分 · 人工写路径缺 revision 校验（🟠 中高）

**为什么留**: 卡在产品决策 —— 发现冲突后给用户看什么？覆盖、合并、还是另存？**没有这个决策，加检查只会把「静默覆盖」变成「报错且丢稿」，更糟。**

**问题**: 两标签页同时打开同一篇，autosave 自动触发 → 后写静默覆盖前写，无冲突提示。AI 路径有 revision 门禁 + 原子 RPC，人工路径两者都没有（`MEMO_UPDATE_CONFLICT` 只在行不存在时触发，不是版本冲突）。

基础设施已齐备: DB trigger 自增 revision，AI 路径已在用。改 `memo.dto.ts:121` 加 `expected_revision` + 服务层走单个原子 RPC 即可复用。本轮已修的是它的可观测性缺口。

### 模式 A · 图标尺寸阶梯只存在于文档里（第二档）

**为什么留**: 品味类，按优先级靠后。**依赖已解除** —— 根因 15 已修，现在可以做。

判据三处明文限定 14/16/20/24px，5 个组件共 10 处手填阶梯外数值（17px×4、18px、15px×2、12px×2）。根因在 `icons.tsx:73` 只收口图标来源、没收口尺寸，`size` 仍是自由 `number`。后果不只是不一致: Lucide 固定 24 viewBox + strokeWidth=2，17px → 1.42px 有效描边落在非整数设备像素上，1× DPR 直接半像素模糊。

修复 — 导出受约束的尺寸类型或语义 size token，把阶梯从口头契约变成类型契约。

### 模式 C · 8 个文件贴着 800 行天花板（第二档）

**为什么留**: 无依赖，但建议在各文件的其他修复完成后一并做，否则反复冲突。

已越线 `index.css` 812、`AppSidebar.tsx` 805；紧贴 `memoTreeStore.ts` 798、`landing.css` 779、`AppDashboard.tsx` 773、`ComponentPreview.tsx` 767、`memo.service.ts` 739、`design-system-workspace.css` 737。

### 根因 16 剩余项（🟡 低，非功能阻塞）

`ThinkingStatusText` live region 永无可暴露文本（读屏静默）、`Skeleton` 的 `aria-busy` 无条件渲染（180ms/360ms 契约管不到无障碍通道）、`ToolCallBubble` 无详情时留下死 tab stop、`AssistantMessage` 滥用 region landmark、`UserMenu` 退出失败渲染常驻 `role="alert"`（违反「瞬时反馈经 ToastProvider」）。

共同根因: 角色区分与状态反馈被下沉到视觉层，live region / aria-busy / tab stop 这些第二通道没有与控制它们的状态机绑定在同一个门禁上。

---

## 建议顺序

1. **根因 1 + 2** — 唯一的数据安全缺口，单独一轮
2. **根因 4 → 根因 5 剩余** — 有依赖，反序会重复劳动
3. **根因 7** — 30 个签名，机械但量大
4. **根因 11 门禁** — 需先定冲突态产品行为
5. **模式 A** — 依赖已解除
6. **模式 C + 根因 16 剩余** — 收尾

---

## 附录 · 经对抗验证被驳回的候选（6 条）

留档以说明验证强度。

| 候选 | 驳回理由 |
| --- | --- |
| styles 三文件缺 `prefers-reduced-motion` | `index.css:799-812` 有全局 `!important` 兜底；且 `segmented-control.css` 只有颜色过渡、`sidebar-button.css:54` 的 `translateY(1px)` 是判据明文允许的 press 反馈 |
| chat 对 LLM 输出裸 parse | `organize.ts:132` 有全局 catch，`:133` 还把 planning Run 标记 failed。防护完整 |
| `role="treeitem"` 无合法父级 | `role="tree"` 在 `AppSidebar.tsx:652`，子层 `role="group"`。ARIA 结构正确 |
| token 刷新触发重拉整树 | `accessToken` 来自 router loader 非状态订阅，后台刷新不更新 prop。**但反向暴露了根因 7** |
| 两处非空断言不安全 | `memoToolExecution.ts:104` read 分支已提前 return；`:57-58` 的 `plan.reference!` 在 reorder 分支必带 reference |
| `charsSinceFlush` 永不归零致 5-8 req/s | 事实对但因果链错: `savingPromise` 串行化把速率钉在 1/RTT。真根因是追赶链无速率下限，已并入根因 8 |

**方法缺陷自陈**: CSS 变量穷尽扫描（`comm -23`）初筛 10 个候选，逐条定型后 9 假 1 真 —— 首版正则只抓行首声明，漏了单行块内的定义。此类机械扫描必须配人工定型，不能直接当结论。
