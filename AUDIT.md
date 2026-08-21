# SuperNote 盲审报告

> 审计日期: 2026-08-21 | 范围: 约 33,000 行 | 方式: 只读盲审，仓库代码零改动
>
> 判据来源: 根 `CLAUDE.md`、`app/CLAUDE.md`、`app/UI_REFINEMENT.md`、`app/brand-spec.md`、`~/.claude/CLAUDE.md`
>
> 方法: 机械底账建候选集 → 8 模块 × 5 视角独立盲扫 → 逐条对抗验证（skeptic 默认站不住，存疑即毙）

---

## 摘要

**表层卫生罕见地干净，问题全在语义层与状态机层。**

| 机械指标 | 结果 |
| --- | --- |
| L3 头部覆盖率 | **100%**（app/src + api/src + chat/src 零缺失） |
| 非 `index.css` 的 CSS 硬编码色值 | **0** |
| 裸 `fetch` 越界 / `as any` / `@ts-ignore` | **0 / 0 / 0** |
| 非空断言 | 仅 2 处，均已验证安全 |
| 契约数值与文档吻合 | autosave 32/1500/8000 + 400/800/1600、Skeleton 180/360 **全部逐一吻合** |

一句话判断: **这不是一个腐烂的代码库，而是一个建了很好的基础设施、却在关键路径上绕过了自己基础设施的代码库。**

`client.ts` 会自动续 token，30 个调用点绕过它；AI 写路径有原子 RPC + revision 门禁，人工写路径不用；`ThemeProvider` 有 localStorage 降级范式，`workspaceChromeStore` 不用；`icons.tsx` 收口了图标来源，没收口尺寸；`ai_commands` 是审计台账，但审批出处可以由客户端撒谎。

统计: 第一档 16 条根因 + 第二档 3 条系统性模式 + GEB 漂移 3 条。另有 6 条候选经对抗验证被毙（见附录 A）。

---

## 第一档 · 会崩的（按严重度排序）

### 根因 1 · 授权执行的 chunk 先于审批裁决送达浏览器

**严重度**: 🔴 极高（数据安全 + 审计完整性）

**触发场景**
权限设为「智能审批」，用户让 AI 删文件夹。模型吐完 `edit_node(op=delete)` 后该 part 变 `input-available`，而 chat 服务还在排空流 + 拉 `getMemoTree` + 跑审批 Agent LLM（**秒级窗口**）。用户此刻点「停止生成」→ **文件夹被真实软删除**，台账写着「智能审批实验综合本轮意图…后批准」—— **这次审批从未发生**。

讽刺之处: 用户看到 AI 要删东西时，本能动作正是点「停止」。**触发条件就是用户的取消意图本身。**

**波及文件**
- `app/node_modules/ai/dist/index.mjs:14056-14066` — `finally` 块**无条件**调 `onFinish`，并传出 `isAbort/isDisconnect/isError`
- `app/node_modules/ai/dist/index.mjs:6104-6113` + `:13876-13883` — `stop()` 只 abort fetch，**不碰 parts**，写工具 part 精确停在 `input-available`
- `app/src/widgets/AgentPanel/AgentPanel.tsx:228` — `onFinish: ({ message }) => {...}` **三个中断标志全丢**
- `app/src/widgets/AgentPanel/AgentPanel.tsx:234-239` — 唯一闸门是 `part.state === "input-available"`，**不检查同条 assistant 是否还有 `approval-requested`**
- `chat/src/routes/chat.ts:296-320` — 审批请求安排在流**排空之后**
- `chat/src/routes/chat.ts:232-247` — `requireWriteApproval` 串行做两件慢事（getMemoTree HTTP + approval-agent LLM 往返）

**影响面比表面更宽**: `isDisconnect`/`isError` 走同一个 `finally` —— 网络抖动、chat 服务崩溃、容器重启全部触发，不只是「点停止」。

**修复位点（唯一上游）**
`chat/src/routes/chat.ts:296-320` —— 写工具的 `tool-input-available` 不得在其审批裁决确定之前到达浏览器。把 `requireWriteApproval` 移进流转发路径（识别到写工具时先裁决、再连同 `tool-approval-request` 一起发出）。

改这一处，客户端 `input-available` 过滤条件**自动变成正确的**，且同时覆盖 abort / disconnect / error / 刷新 / chat 崩溃全部终止路径。

> ⚠️ 在 `AgentPanel.tsx:228` 加 `isAbort` 判断只能挡住 SDK 恰好暴露的三个标志，是症状层补丁 —— **别选它**。

**边界修正（诚实说明）**: `ask` 模式偶然安全（`memoToolExecution.ts:84-86` 会 throw，catch 走 rollback）；`full_access` 是用户明示授权。漏洞**精确地只在 auto_approve** —— 唯一缺防线的模式，恰好是把审批外包给 Agent 的那个。

---

### 根因 2 · 审批出处由客户端自述且不可验证

**严重度**: 🔴 极高（审计台账可撒谎）

与根因 1 可分离 —— race 只是暴露了它。即使修好根因 1，这条依然独立存在。

**触发场景**
任何能构造 HTTP 请求的客户端（含被篡改的前端）都可以声称 `approval_source="approval_agent"` 创建写命令。api 全链路无一处校验审批是否真的发生过。

**波及文件**
- `app/src/widgets/AgentPanel/memoToolExecution.ts:87-92` — 凭本地 permission mode 就署名 `approval_source="approval_agent"` 和一句「综合本轮意图、实际目标、修改参数和影响范围后批准」
- `api/src/router/ai.router.ts:61-65` → `api/src/service/ai-command.service.ts:89-97` — **零业务判断**，只有 `resolveCommandResult(await aiRepository.createCommand(...))`
- `api/src/repository/ai.repository.ts:388` — `p_approval_source: input.approval_source ?? null` 原样下传
- `api/supabase/ai-command.sql:422-429` — 唯一检查是「模式与来源**自洽性**」，不是「审批是否真的发生过」；`:453` 直接给 `'approved'`，`:467-469` 同事务立刻 `apply_ai_command`
- `chat/src/lib/approval-coordinator.ts:43-58` — `evaluateWriteApproval` 是纯函数，返回值即消失，**不落任何库**
- `chat/src/routes/chat-persistence.ts:103-116` — `markResponseStatus` 只在消息级盖 `status:"aborted"`，不动 tool part 状态，事后审计连「审批从未下发」都推不出来

**关键缺口**: AI SDK **自带** approval signature 机制（`index.mjs:115` `InvalidToolApprovalSignatureError`、`:3118` `tool-approval-signature.ts`、`:6158` 消费 `chunk.signature`），但 `chat/src/routes/chat.ts:314-318` 写审批请求时只给了 `approvalId` + `toolCallId`，**没有 signature** —— 即使 api 想验也无物可验。

**修复位点**
让 chat 侧的自动批准以不可伪造凭据（AI SDK 现成的 approval signature）传递到 api，或 api 干脆拒绝客户端自述的 `approval_agent`。

不修这条，「可撤销命令台账」作为审计事实源的地位只是名义上的。

---

### 根因 3 · Escape 无层级仲裁，误关等于草稿销毁

**严重度**: 🔴 高（数据丢失 + 键盘可访问性）

三个互不知情的视角（shared/a11y、widgets/a11y、agentpanel/a11y）**独立撞到同一根因**。

**触发场景**
AI 面板打开，Composer 里输入「帮我整理 @项目」，@候选弹出，按 Escape 只想收起候选 → 候选关闭 **+ 整个 AI 面板卸载 + 已输入正文与已选引用全部丢失**。

同源路径另有 4 条:
- F2 进入树行重命名，按 Escape 取消 → 连带关闭整个文件库
- 文件库内右键新建文件夹 → MemoNodeDialog 按 Escape → 弹窗关闭 + 背后文件库消失，焦点无处归还
- 侧栏搜索激活后按 Escape → 搜索关闭 + 文件库一起关闭
- Paper 顶部 More 菜单按 Escape → 菜单关闭 + 已打开的 AI 面板被一并关掉

**波及文件**
- `app/src/widgets/PaperWorkspaceShell.tsx:111-121` — window 监听器只查 `event.key !== "Escape"`，**不检查 `event.defaultPrevented`**，无条件关 Panel
- `app/src/shared/design-system/components/Dialog.tsx:63` — 只 `preventDefault()`
- `app/src/shared/design-system/components/UserMenu.tsx:61` — 只 `setOpen(false)`
- `app/src/shared/design-system/components/Select.tsx:122` — 只 `preventDefault()`
- `app/src/widgets/AgentPanel/AgentPanel.tsx:439` — 只 `preventDefault()`
- `app/src/widgets/MemoTreeBranch.tsx:189`、`app/src/widgets/AppSidebar.tsx:350,561`、`app/src/widgets/MarkdownViewMenu.tsx:74`、`app/src/widgets/AgentPanel/ThreadHistory.tsx:49` — 同样只 preventDefault
- `app/src/widgets/PaperWorkspaceShell.tsx:264-285` — Panel 是 `AnimatePresence` **条件渲染（卸载）**，非隐藏
- `app/src/widgets/AgentPanel/AgentPanel.tsx:157-158` — `inputValue`/`sources` 是纯本地 state，从未持久化
- `app/src/shared/design-system/components/Dialog.tsx:105` — 焦点归还打到正被卸载的节点上，`activeElement` 退回 body

**技术要点**: `preventDefault` 对已注册的 window 监听器**毫无作用** —— 它只阻止浏览器默认行为，不阻止事件继续派发。React 19 事件委托挂在 root container，原生事件继续冒泡到 document 再到 window，因此「内层先响应」并不阻止壳层响应。

**修复位点**
建立单一裁决点: overlay 层级栈（最上层独占 Escape）或 `defaultPrevented` 协议。同时让 Panel 用隐藏而非卸载，使一次误触不再升级为不可恢复的数据丢失。

---

### 根因 4 · tree 载荷把「结构」与「正文」耦合成不可分载荷

**严重度**: 🔴 高（约 200 篇笔记后应用完全打不开）

**触发场景**
笔记累积到约 200 篇时，`in.(...)` 拼接的 UUID 列表撞 8KB 网关/PostgREST URL 上限 → `/memo-tree` 整体返回 431/414 → **应用完全打不开**。对「面向需要长期积累备忘录的用户」的产品，200 篇是极低的天花板。

**波及文件**
- `api/src/model/memo.model.ts:37-40` — `MemoTreeNode extends MemoNode { children; memo: MemoContent | null }`（**契约层耦合点**）
- `api/src/service/memo.service.ts:162` `buildMemoTree` — 每个 memo 节点塞完整 `content_mdx`
- `api/src/service/memo.service.ts:404-418` `getTree` — 一次 `listActiveNodes` + 一次 `listContents`，**无批次切分**
- `api/src/repository/memo.repository.ts:115-128` `listContents` — `select: "*"` + `in: { node_id }`
- `api/src/lib/supabase-rest.ts:131-145` — `in.(...)` 全部 UUID 拼进 GET query string（约 39B/UUID，含引号逗号）

**三个下游后果**
1. **URL 长度硬上限** —— 上述崩溃
2. 载荷随笔记总量线性膨胀，每次进入 Dashboard 全量下载全部正文
3. 客户端搜索被迫吃全文（见根因 5）

**修复位点**
`api/src/model/memo.model.ts:37-40` 的契约拆分 —— tree 只返回结构 + excerpt，正文按需单取。这一处改动同时消解 1、2、3。

---

### 根因 5 · 正文草稿写进全局树，把单字段变更放大成全树重建

**严重度**: 🔴 高（主写作路径输入延迟与树规模成正比）

两个视角（shared/performance、widgets/performance）独立发现。

**触发场景**
文件库打开、树里有 200-300 个可见行，在 Paper 正文里连续打字。**每敲一个字符**触发全树 O(N) 克隆 + 全部可见行重渲染 —— **树越大，打字越卡**。

**波及文件**
- `app/src/shared/store/memoTree.ts:113,122` — `updateNode` 递归**不剪枝**: 凡有 children 的节点无条件 `{...node, children: updateNode(...)}`，即使目标不在该子树内
- `app/src/shared/store/memoTreeStore.ts:575-577` — `updateMemoContentLocal` 每字符调 `updateNode` 重建整树 + `set({nodes})` 广播新引用
- `app/src/widgets/useMemoAutosave.ts:451` — 无节流直接回调
- `app/src/pages/AppDashboard.tsx:109,651-653` — 订阅 `state.nodes`，每字符重渲染
- `app/src/widgets/AppSidebar.tsx:227` — `treeStructureKey` 全树字符串拼接（依赖 `[memoTree]`，必然失效）
- `app/src/widgets/AppSidebar.tsx:234` — `searchMemoTree` **裸在 render body，无 useMemo** → 全树全文扫描
- `app/src/widgets/useMemoTreeExpansion.ts:117` — `JSON.stringify(folderIds)` 重做
- `app/src/widgets/MemoTreeBranch.tsx:202,321,379` — 裸函数组件 + 递归 `{...props}` 展开 + 非 memo 的 `SidebarButton`/`ArcherElement`
- `app/src/widgets/memoLibrary.ts:168` — `searchMemoTree` 把 `content_mdx` 纳入匹配（根因 4 的下游）
- `app/src/widgets/AgentPanel/MentionMenu.tsx:36` — `visit(tree,[])` **无条件执行**，query 非空时 `recent` 完全不被使用（`:37` 走另一分支）→ 每次按键白扫全树
- `app/src/widgets/AgentPanel/MentionMenu.tsx:42` — `.map` 内对每个结果再 `findNode(tree,...)` → N 次全树查找

**修复位点**
两处上游: (a) `memoTree.ts:122` 让 `updateNode` 只克隆祖先路径（剪枝）；(b) 正文草稿不写进全局树 —— 它已由 `useMemoAutosave` 本地持有。

---

### 根因 6 · AI 会话列表零 memo 边界，上游任意更新触发全量 Markdown 重解析

**严重度**: 🔴 高（性能 + 滚动劫持）

**触发场景**
AI 面板打开、会话已有 M 条带 Markdown 的回复，在 Paper 编辑器里连续打字。每次按键 → 全部历史回复重跑 remark/rehype 全量解析 + **M 次 `scrollTo`/`scrollHeight` 强制同步布局**，AI 列表被反复拽到底部 —— **用户上滑读历史时无法停留**。

**波及文件**
- `app/src/widgets/AgentPanel/AgentPanel.tsx:527,530` — `onProgress` 写成**内联箭头函数**，每次渲染新建
- `app/src/shared/design-system/components/StreamingText.tsx:213-215` — 把 `onProgress` 放进 **effect 依赖数组**，语义从「text 前进时通知」退化为「任何渲染都通知」
- `app/src/widgets/AgentPanel/ChatMessage.tsx:147,173` — 裸函数组件 + `deriveAgentMessagePresentation` 每次重跑
- `app/src/widgets/AgentPanel/AgentPanel.tsx:316` + `messagePresentation.ts:29` — `coalesceAssistantMessages` 每次重建对象与 parts 数组
- `app/node_modules/react-markdown/lib/index.js:175-178` — 无 memo，**在 render 内**执行 `processor.parse + runSync`
- `app/src/widgets/AgentPanel/AgentProcessDisclosure.tsx:62` — 用 `hidden` 而非卸载，收起的过程区照样参与解析
- `app/src/widgets/AgentPanel/AgentPanel.tsx:182-189` — `mentionResults` 全树遍历被 `memoTree`/`sources` 引用变化无条件作废，即使 @菜单未打开

**修复位点**
`StreamingText.tsx:213-215` 把 `onProgress` 移出 effect 依赖（改用 ref）+ `ChatMessage` memo 化 + `AgentPanel.tsx:527,530` 回调 `useCallback` 稳定化。

---

### 根因 7 · 会话过期后 autosave 静默失败，无重新认证路径

**严重度**: 🔴 高（数据丢失）

**触发场景**
在 `/app` 写作超过 Supabase token 有效期（默认 1 小时）且无路由导航 —— **对长期写作产品是常态** —— 之后每轮 autosave 拿旧 token 打 401，重试 3 次全失败，只弹「自动保存失败」Toast，**无任何重新登录引导**。用户继续写，草稿只在内存，刷新页面全丢。

**波及文件**
- `app/src/shared/api/client.ts:74` — **有能力**实时取新 token: `explicitAccessToken ?? await getAuthenticatedAccessToken()`
- `app/src/shared/api/memo.ts` / `ai.ts` / `profile.ts` — 共 **30 个签名强制 `accessToken: string`**，全部绕过该能力
- `app/src/app/router/index.tsx:111` — token 源自 router loader，**只在路由导航时刷新**
- `app/src/app/router/index.tsx:121` — `isUnauthorizedApiError` 的**唯一消费者**，运行时 401 无任何处理
- `app/src/widgets/NotesWorkspace.tsx:127-133` — `onFailure` 只弹 Toast，不区分 401 与网络错误

**修复位点**
让 401 有统一的运行时处理路径（触发静默 token 刷新 + 重试，失败才引导重新登录），而非只在 loader 边界处理。

---

### 根因 8 · page-exit flush 在保存在飞时提前 return，keepalive 从未发出

**严重度**: 🔴 高（数据丢失）

**触发场景**
连续快速输入满 32 字符触发 flush，PATCH 进入在飞（50-500ms）；用户在该窗口内继续敲字，然后**直接关闭标签页**。退出 flush 命中在飞分支 → await 后裸 return，**全程未发 keepalive 请求**；同时无 keepalive 的在飞 PATCH 被卸载取消。

**波及文件**
- `app/src/widgets/useMemoAutosave.ts:417-419` — `flushForPageExit` 只传 `{keepalive:true}`，**不传 `throwOnFailure`**
- `app/src/widgets/useMemoAutosave.ts:222-235` — 在飞分支 await 后**裸 return**；`:231` 的递归续写被 `throwOnFailure` 门禁挡住
- `app/src/widgets/useMemoAutosave.ts:246` — keepalive **唯一注入点**，永远到不了
- `app/src/widgets/useMemoAutosave.ts:300-303` — 唯一兜底是 macrotask `setTimeout`（卸载后不执行）**且不带 options**（补发无 keepalive）
- `app/src/widgets/useMemoAutosave.ts:112-119` — 被取消的 fetch 抛错后先 `await wait(400)`，页面已消失，`onFailure` 永不触发（**静默性成立**）
- `app/src/shared/api/memo.ts:186` + `app/src/shared/api/client.ts:98-104` — keepalive 管线本身是通的，证明这是真实缺口

违反 `app/UI_REFINEMENT.md:117` 明文承诺的「blur/switch/hidden/**page exit** flush」。

**诚实修正（对抗验证提供）**
- `visibilitychange` 路径**不丢** —— 页面存活，在飞请求正常返回，`:292-303` 会链式补发。真实丢失窗口只在 `beforeunload`/`pagehide` 的真卸载
- 丢失量不是「最后一次成功落库之后的全部输入」，而是**在飞请求快照之后的增量**

**修复位点**
`useMemoAutosave.ts:222-235` 的在飞分支必须为 keepalive 语义新建请求，而不是复用在飞的普通请求。

---

### 根因 9 · treeGeneration 门禁把 id 身份映射连坐清掉

**严重度**: 🔴 高（数据正确性）

**触发场景**
乐观创建 memo，`POST /memos` 在飞期间任何 `fetchTree`（`:327` 预增 generation）或 `reset()`（`:785`）落地 → `resolvedMemoIds`/`memoClientKeys` 映射**永久丢失** → 编辑器继续用临时 id 寻址，autosave 打向不存在的 id。

**波及文件**
- `app/src/shared/store/memoTreeStore.ts:288-291` — `beginCreateMemo` 只在 `generation === treeGeneration` 时记录映射
- `app/src/shared/store/memoTreeStore.ts:309-314` — `failedMemoCreations` 同样受门禁
- `app/src/shared/store/memoTreeStore.ts:327` — `fetchTree` 预增 `treeGeneration`
- `app/src/shared/store/memoTreeStore.ts:785` — `reset()` 递增 generation

**根因分析**
id 身份记账被当作 generation 作用域的**视图状态**，但**节点身份能跨越整树重取**。只有视觉 `set()` 该受 generation 门禁，映射必须无条件记录。

**修复位点**
`memoTreeStore.ts:288-291` — 把映射记录移出 generation 门禁。

---

### 根因 10 · AbortError 被伪装成协议违规，abort 守卫全部失效

**严重度**: 🔴 高（错误处理缺口）

**触发场景**
`AppDashboard` 或 `TrashWorkspace` 卸载/切换时 `controller.abort()`，若 abort 落在**读 response body** 期间，`await response.json()` 抛同一个 AbortError DOMException，被裸 `catch {}` 吞掉，转成 `ApiError(status,"INVALID_API_RESPONSE")` → 正常取消被当成「后端返回畸形响应」，弹错误 Toast。

**波及文件**
- `app/src/shared/api/client.ts:42-53` `readEnvelope` — `try { payload = await response.json() } catch { throw new ApiError(...,"INVALID_API_RESPONSE") }`
- `app/src/shared/api/client.ts:106-108` — AbortError 只对 `fetch()` 拒绝重抛
- `app/src/pages/AppDashboard.tsx:207,227` — `AbortController` + `abort()`
- `app/src/widgets/TrashWorkspace.tsx:43,59` — 同上
- `app/src/pages/AppDashboard.tsx:215` — `error instanceof DOMException && error.name === "AbortError"` 守卫因此失效

**根因分析**
abort 被建模为「fetch 层关注点」，但取消是**整个响应生命周期**（headers + body）的信号。

**修复位点**
`client.ts:42-53` — body 消费也要重抛 AbortError。

---

### 根因 11 · 人工写路径缺失 AI 写路径已建好的原子性与版本门禁

**严重度**: 🟠 中高（静默数据覆盖）

**不对称性**: AI 路径有 revision 门禁 + 原子 RPC，人工路径两者都没有。

**触发场景**
两个浏览器标签页同时打开同一篇笔记，autosave 自动触发（用户无需有意识地"同时编辑"）→ **后写静默覆盖前写，无冲突提示**。

**波及文件**
- `api/supabase/ai-command.sql:89` — AI 路径: RPC 内强制 `target.revision <> command_record.expected_revision` → 拒绝
- `api/src/dto/memo.dto.ts:121-129` — `patchMemoSchema` 只收 `content_mdx`/`title`，**无 revision 入参**
- `api/src/service/memo.service.ts:470-515` — title 与 content **两次独立非原子写**
- `api/src/service/memo.service.ts:437-447` — `restoreTitle` 补偿回滚，**catch 为空** → 补偿失败静默留半写状态

`MEMO_UPDATE_CONFLICT` 只在行不存在时触发（RLS/软删），**不是版本冲突**。

**修复位点**
`api/src/dto/memo.dto.ts:121` 增加 `expected_revision` + 服务层走单个原子 RPC（复用 AI 路径已有的基础设施）。

---

### 根因 12 · localStorage 裸用未降级，可致 /app 整页白屏

**严重度**: 🟠 中高（可用性）

**触发场景**
浏览器勾选「阻止全部 Cookie 和站点数据」或 localStorage 配额满 → `AppDashboard.tsx:179` 调 `hydrateWorkspaceChrome` → `SecurityError` 从 Zustand `set` updater 穿出 useEffect → **整个 Paper First 工作台白屏，用户一篇备忘录都打不开**。

退化场景: 若 hydrate 侥幸通过而写入受限，则每次点文件库/AI 开关都在 `persist` 抛错，且因 `throw` 早于 `return nextState`，**开关连内存里都不翻转** —— 看起来彻底点不动。

**波及文件**
- `app/src/shared/store/workspaceChromeStore.ts:81` — `window.localStorage.setItem` 无 try/catch
- `app/src/shared/store/workspaceChromeStore.ts:110-111` — `getItem` × 2 无 try/catch
- `app/src/shared/store/workspaceChromeStore.ts:94-98` — `persist(nextState)` 在 `set()` updater **内部**且位于 `return` **之前**
- `app/src/pages/AppDashboard.tsx:179` — 调用点
- `app/src/shared/theme/ThemeProvider.tsx:35-49` — **同模块已建立**的正确范式（`readStoredValue`/`persistValue` + try/catch，注释明写「持久化不可用时保持静默降级」）

作者已考虑数据损坏（`parseWorkspaceChrome:46-58` 包了 `JSON.parse` 的 try/catch），却漏掉**访问器本身会抛**这一类。

**修复位点**
`workspaceChromeStore.ts:71-116` — 遵循 `ThemeProvider` 已有范式，并把 persist 移出 reducer。

---

### 根因 13 · onFinish 自动执行写工具期间 busy 为假，会话可被卸载

**严重度**: 🟠 中高（状态机漏洞 + tool result 永久丢失）

**触发场景**
权限「完全访问」，AI 改名某篇笔记。SSE 流在发出 tool call 后立即结束，`status` 变 ready → `chatBusy=false`，此时 `onFinish` 正在跑 Worker 规划 + `getAiSettings` + `createAiCommand` 两次网络往返。这几百毫秒内点 Header「会话历史」→ AgentConversation 卸载 → **command 已落库、树已改变，但 tool result 永久丢失**，assistant 回复永远停在 `input-available`。

**波及文件**
- `app/src/widgets/AgentPanel/AgentPanel.tsx:307` — `busy = streamBusy || respondingApprovalId !== null`，把「客户端工具正在执行」等同于**空闲**
- `app/src/widgets/AgentPanel/AgentPanel.tsx:229,236,269` — onFinish fire-and-forget
- `app/src/widgets/AgentPanel/AgentPanel.tsx:557,587,595,600` — 历史打开/新会话/收起/发送**全部只读 `chatBusy`**
- `app/src/widgets/AgentPanel/AgentPanel.tsx:385` — 刷新恢复只认 `approval-responded`，不会补齐 `input-available`
- `app/src/widgets/AgentPanel/memoToolExecution.ts:105,111-121` — 先投影，再两次串行 HTTP

手工审批路径恰好被 `respondingApprovalId` 顺带覆盖，**掩盖了这个缺口** —— 只有自动通过路径暴露。

**修复位点**
`AgentPanel.tsx:307` — busy 增加「客户端工具执行中」阶段。

---

### 根因 14 · Dialog 焦点陷阱只在边界元素生效，Shift+Tab 可逃出模态

**严重度**: 🟠 中（可访问性）

**触发场景**
打开 AccountDialog，焦点停在 panel 容器自身（`tabIndex=-1`）或 body 上时按 Shift+Tab → **焦点直接穿出到被弹窗遮住、且 body 已被锁滚的应用界面**，键盘用户操作不可见的元素。

**波及文件**
- `app/src/shared/design-system/components/Dialog.tsx:89` — Tab 循环仅在 `document.activeElement` 恰好等于首/尾可聚焦元素时 `preventDefault`
- 背景内容既无 `inert` 也无 `aria-hidden`

**根因分析**
焦点陷阱写成「边界元素等值比较」而非「焦点是否仍在容器内」的不变量 —— 缺少 `panelRef.current.contains(document.activeElement)` 兜底。`aria-modal="true"` 只影响读屏虚拟光标，**无法阻止真实 Tab 序列离开对话框**。

**修复位点**
`Dialog.tsx:89` — 改为 contains 判定 + 背景加 `inert`。

---

### 根因 15 · `--space-5` 未定义致 Toast 图标槽塌陷

**严重度**: 🟠 中（视觉契约，机械可判定）

**触发场景**
任意 Toast 弹出 → `.ds-toast-icon` 的 `width`/`height` 双双解析失败 → 图标槽退化为 `inline-flex` 内容尺寸。

**波及文件**
- `app/src/index.css:182-191` — `--space-*` 阶梯定义为 1,2,3,4,**6**,8,10,12,16,24 —— **跳过了 5**
- `app/src/styles/toast.css:142-143` — `width: var(--space-5)` / `height: var(--space-5)`，**无 fallback**
- `app/src/styles/color-lab.css:84` — `margin: 0 auto var(--space-5)`

`--spacing: 0.25rem`（4px 基线），`--space-5` 本应解析为 **20px** —— 正是判据要求的 20px 图标槽。

**与模式 A 互为因果**: Toast 关闭键之所以手填 12px，是因为**它的图标槽本身就是塌的**。修 `--space-5` 才是上游，改 12px 是给塌陷打补丁。

**修复位点**
`app/src/index.css:185` 之后补 `--space-5: calc(var(--spacing) * 5);`

---

### 根因 16 · 一批 shared 组件的可访问性契约缺口

**严重度**: 🟠 中 / 🟡 低（同属「无障碍层被下沉到视觉层」这一根因的不同显形）

| 位置 | 问题 | 触发场景 |
| --- | --- | --- |
| `workspaceChromeStore.ts:108` | `hydrate()` 绕过 `<1400px` 互斥规则，直接把双开快照写进 state | 窄屏刷新页面 → 双 Panel 同开，违反 `app/CLAUDE.md` 「低于该宽度时互斥覆盖」 |
| `MentionInput.tsx:133` | `useLayoutEffect` 早退条件同时要求 `lastDomValue` 与 `mentionSignature` 未变；删 @token 时 text 未变但 mentions 变了 → `replaceChildren` 重建 DOM + 无条件 `placeCaretAtEnd` | 在正文中间编辑/删除 @token → **光标被弹到末尾** |
| `UserMenu.tsx:76` | `closeAndRun` 先卸载菜单再执行动作，被点击的 menuitem 同批次移除，`activeElement` 退回 body；下游 Dialog 把 body 记为 `previousActiveElement`，关闭时 `body.focus()` 空操作 | 菜单点「设置」→ 弹窗关闭后**焦点彻底丢失**，下次 Tab 从文档顶部开始 |
| `UserMenu.tsx:101` | 无 roving tabindex、不处理 Tab/focusout；四个 `role="menuitem"` 都是默认可 Tab 的原生 button | Tab 走出最后一项后菜单**仍悬浮**（打开但焦点在外的非法中间态） |
| `Select.tsx:98` | `openSelect` 不调 `triggerRef.focus()`（只有 `selectOption` 做了）；Escape/方向键/Home/End 全绑在 trigger `onKeyDown` 上 | macOS Safari/Firefox 点击 button 不赋焦点 → 打开后**键盘完全失控**，只剩点击外部一条关闭路径 |
| `ThinkingStatusText.tsx:49` | 三条状态文字挂载时全部渲染并各带 `aria-hidden="true"`，轮换只切 `data-active`；`role=status` live region **永无可暴露文本** | AI 开始思考/状态轮换时读屏**完全静默** |
| `Skeleton.tsx:63` | `aria-busy="true"` + sr-only `role="status"` **无条件**渲染；`visible` 只经 `data-visible` 走 CSS opacity | 180ms 延迟 / 360ms 最短可见契约**管不到无障碍通道**，未显示时已在播报 loading |
| `ToolCallBubble.tsx:90` | `onClick` 只在 `details.length > 0` 时挂载，button 元素始终存在且默认可聚焦 | 无详情工具 → Tab 到一个读作按钮、按 Enter/Space 无反应的**死停靠点** |
| `AssistantMessage.tsx:34` | 用带 `aria-label` 的 `<section>` → 每条回复都是同名 **region landmark**（滥用全局导航语义表达局部条目）；`UserMessageBubble.tsx` 是裸 div，无任何角色信息 | 读屏用户拿不到「谁在说话」；landmark 列表被同名项污染 |
| `UserMenu.tsx:193,204-208` | 退出失败渲染**常驻** `<p role="alert">`，无过期机制 | 违反 `app/CLAUDE.md` 「瞬时业务反馈必须经根级 ToastProvider 发出，不在页面重复实现通知浮层」 |

**共同根因**: 角色区分与状态反馈被下沉到视觉层，无障碍层只做零散补偿；而 live region / aria-busy / tab stop 这些「第二通道」没有与控制它们的状态机绑定在同一个门禁上。

**修复位点**
优先修可致功能不可用的三条: `Select.tsx:98`（键盘失控）、`MentionInput.tsx:133`（光标跳失）、`UserMenu.tsx:76`（焦点链断裂）。

---

## 第二档 · 系统性模式（仅报同一反模式 ≥3 处者，报模式不报实例）

### 模式 A · 图标尺寸阶梯只存在于文档里

判据三处明文限定 **14/16/20/24px** 四档（`app/CLAUDE.md` 图标系统约束、`brand-spec.md` Iconography、`UI_REFINEMENT.md:66`），但 **5 个生产组件共 10 处**手填阶梯外数值:

| 文件:行 | 值 |
| --- | --- |
| `UserMenu.tsx:162,173,182,198` | 17px × 4 |
| `Select.tsx:232` / `:243` | 17px / 15px |
| `PasswordInput.tsx:46` | 18px |
| `Toast.tsx:94` | 12px |
| `ToolCallBubble.tsx:94` / `:99` | 15px / 12px |

对照组: `Button.tsx:63`、`SegmentedControl.tsx:114`、`UserButton.tsx:63`、`Select.tsx:200` 老实用 16px —— 说明不是阶梯定义有误，而是**调用点漂移**。

**根因**: `app/src/shared/design-system/icons.tsx:73` 只收口「图标图形来源」（Lucide → 语义别名），**没收口尺寸** —— `size` 仍是自由 `number`，无 `IconSize = 14|16|20|24` 类型约束、无尺寸常量。四档阶梯靠人肉遵守，typecheck 与 lint 都拦不住。

**后果不只是不一致**: Lucide 固定 24 viewBox + `strokeWidth=2`，17px → 1.42px、15px → 1.25px 有效描边，**落在非整数设备像素上**，1× DPR 直接半像素模糊。同屏 `UserButton` 16px 与菜单 17px 并列时可见光学错位。

**修复位点**: `icons.tsx` 导出受约束的尺寸类型或语义 size token，把阶梯从口头契约变成类型契约。

---

### 模式 B · 弹层「外部点击关闭」5 处各自手写，行为三向分叉

| 文件:行 | 宿主 | Escape | 焦点归还 | 依赖数组 |
| --- | --- | --- | --- | --- |
| `UserMenu.tsx:67-72` | document | ✅ | ✅ | `[open]` |
| `Select.tsx:94-96` | document | ❌ | ❌ | `[open]` |
| `MarkdownViewMenu.tsx:82-87` | document | ✅ | ✅ | `[open]` |
| `AppSidebar.tsx:357-366` | window | ✅ | — | 含 resize/scroll 捕获 |
| `PermissionModeControl.tsx:72-78` | document | ❌ | ❌ | **`[]`** |

差异导致两条真实的第一档缺陷:
- `Select` 与 `PermissionModeControl` **无 Escape 关闭** → 键盘用户打开后无退出路径
- `PermissionModeControl.tsx:78` 依赖数组是 `[]`（非 `[open]`）→ 监听器**整个挂载期常驻**，菜单关闭时每次页面 pointerdown 都跑 `contains()` + `setOpen(false)`

**修复位点**: 收敛为一个 `useDismissable` 原语（外部点击 + Escape + 焦点归还 + 层级栈），**同时消灭根因 3 的一半**。

---

### 模式 C · 8 个文件贴着 800 行天花板

判据（`~/.claude/CLAUDE.md`）: 单文件 ≤ 800 行，超出即重构契机。

已越线: `app/src/index.css` **812**、`app/src/widgets/AppSidebar.tsx` **805**
紧贴: `memoTreeStore.ts` 798、`styles/landing.css` 779、`AppDashboard.tsx` 773、`ComponentPreview.tsx` 767、`api/src/service/memo.service.ts` 739、`styles/design-system-workspace.css` 737

长到极限却无拆分动作 —— 8 处构成模式。

---

## GEB 文档漂移

L3 头部 **100% 覆盖，零缺失** —— 这个协议贯彻得非常彻底。以下 3 条为 L2 层与文档一致性问题:

| # | 位置 | 类型 | 问题 |
| --- | --- | --- | --- |
| 1 | `app/src/shared/CLAUDE.md` | l2-stale | 成员清单列了 `ui/`，但 `app/src/shared/ui/` 是**空目录**（0 条目） |
| 2 | `chat/src/mastra/CLAUDE.md` | l2-stale | 成员清单列了 `public/`，但 `chat/src/mastra/public/` 是**空目录**（0 条目） |
| 3 | `app/CLAUDE.md:28` ↔ `app/UI_REFINEMENT.md:49,112` | 文档自相矛盾 | `app/CLAUDE.md:28` 写「双击任意 folder/memo…均进入同一原地 input」；`UI_REFINEMENT.md:49` 写「double-click never enters edit mode」，`:112` 记录该能力已于 2026-08-08 移除。**代码站在 CLAUDE.md 一边**（`MemoTreeBranch.tsx:339-344` 有 `onDoubleClick → onBeginRename`） |

**关于第 3 条的代码侧后果**（原第一档发现，因需先裁决文档分叉而归入此处）:
像在文件管理器里双击打开笔记 → 进入重命名 input → 点别处 blur → **一次多余的 PATCH + 一条「名称已更新」虚假成功 Toast**（用户从未重命名任何东西）；网络失败时还会弹「重命名保存失败」错误 Toast。
提交路径无「标题未变」短路: `MemoTreeBranch.tsx:177`（blur 无条件 onCommit）、`AppSidebar.tsx:427`（只判 `length > 0`）、`AppDashboard.tsx:393`（不短路）。

**需要你先裁决**: 双击是否应进入重命名。裁决后消除文档分叉，再改代码。

---

## 修复优先级与依赖关系

### 阶段 1 · 数据安全（必须串行，同属审批链）

```
根因 1 (chat/src/routes/chat.ts:296-320  审批先于执行)
   └─→ 根因 2 (approval signature 不可伪造凭据)
```
根因 1 修好后，客户端 `input-available` 闸门自动正确。根因 2 独立存在，但两者同属审批链，建议同批处理以免台账留下不可信历史。

**根因 13** 可并行（`AgentPanel.tsx:307` busy 阶段），与 1/2 无冲突。

### 阶段 2 · 数据丢失（可并行，互不依赖）

- **根因 3** — Escape 层级仲裁（`PaperWorkspaceShell.tsx:111` + 内层协议）→ 建议与**模式 B** 一起做，`useDismissable` 原语同时解决两者
- **根因 7** — 401 运行时处理路径
- **根因 8** — `useMemoAutosave.ts:222-235` keepalive 新建请求
- **根因 9** — `memoTreeStore.ts:288` 映射移出 generation 门禁
- **根因 10** — `client.ts:42-53` body 消费重抛 AbortError

### 阶段 3 · 性能（有依赖，需串行）

```
根因 4 (memo.model.ts:37-40  tree 契约拆分)
   └─→ 根因 5 (memoTree.ts:122 剪枝 + 草稿不入全局树)
          └─→ 模式 B 已完成的前提下，根因 6 (StreamingText onProgress 移出 effect 依赖)
```
根因 4 是根因 5 的上游（tree 不带全文后，搜索全文扫描问题自然消解一半）。根因 6 独立，但改动区域与根因 5 重叠（AgentPanel 渲染链），建议顺序做以免冲突。

### 阶段 4 · 正确性与可用性（可并行）

- **根因 11** — `memo.dto.ts:121` + 服务层原子 RPC
- **根因 12** — `workspaceChromeStore.ts` 遵循 ThemeProvider 范式
- **根因 14** — `Dialog.tsx:89` contains 判定 + 背景 inert
- **根因 15** — `index.css:185` 补 `--space-5`（**必须先于模式 A**）
- **根因 16** — 优先 `Select.tsx:98`、`MentionInput.tsx:133`、`UserMenu.tsx:76`

### 阶段 5 · 品味（依赖前置修复）

```
根因 15 (--space-5)  ─→  模式 A (icons.tsx 尺寸类型收口)
根因 3  ─────────────→  模式 B (useDismissable 原语)
GEB #3 裁决 ─────────→  双击重命名代码修正
模式 C (文件拆分) ── 无依赖，建议在对应文件的其他修复完成后一并做
```

### 关键提醒

1. **根因 15 必须先于模式 A** —— 不修 `--space-5` 就去调 Toast 图标尺寸，是在给塌陷打补丁
2. **根因 4 必须先于根因 5** —— 反序会导致重复劳动
3. **模式 B 与根因 3 应同批** —— `useDismissable` 原语是两者的共同解
4. **根因 1 的修复位点在 chat 服务端** —— 不要在 `AgentPanel.tsx:228` 打症状补丁
5. **GEB #3 需要你先做产品裁决** —— 代码与两份判据文件三方不一致，改代码前先定方向

---

## 附录 A · 经对抗验证被毙的候选（6 条）

留档以说明验证强度。

| 候选 | 毙掉理由 |
| --- | --- |
| styles 三文件缺 `prefers-reduced-motion` | `index.css:799-812` 有全局 `!important` 兜底覆盖所有 `animation-duration`/`transition-duration`；且 `segmented-control.css` 只有颜色过渡、`sidebar-button.css:54` 的 `translateY(1px)` 是判据**明文允许**的 press 反馈 |
| chat 对 LLM 输出裸 parse（`organize-contracts.ts:73`） | `organize.ts:132` 有全局 catch，`:133` 还把 planning Run 标记 failed。防护完整 |
| `role="treeitem"` 无合法父级 | `role="tree"` 在 `AppSidebar.tsx:652`，`MemoTreeBranch` 的 `depth=0` 不重复加 role，子层 `role="group"`。ARIA 结构正确 |
| token 刷新触发重拉整树（`AppDashboard.tsx:206-228`） | `accessToken` 来自 router loader 非状态订阅，后台刷新不更新 prop。**但反向暴露了根因 7** |
| 两处非空断言不安全 | `memoToolExecution.ts:104` read 分支已提前 return（`:101`）；`:57-58` 的 `plan.reference!` 在 `memoToolPlanner.ts:281-284` reorder 分支必带 reference。均安全 |
| `charsSinceFlush` 永不归零导致 5-8 req/s | 事实陈述对，但**因果链错**: `:322-325` 在有在飞请求时是 no-op（`savingPromise` 串行化把速率钉在 1/RTT）。反事实检验证明按该行号修改不改变任何观测量。**真根因是 `:292-303` 追赶链无速率下限**（已并入根因 8 的附注） |

## 附录 B · CSS 变量穷尽扫描（shell 全量，非 agent）

`comm -23`（引用集 − 定义集）初筛 10 个候选，逐条定型后 **9 假 1 真**:

| 变量 | 判定 |
| --- | --- |
| `--space-5` | 🔴 **真缺失** → 根因 15 |
| `--memo-tree-step` | ✅ 带 `, 1rem` fallback，且 `workspace.css:288` 有定义 |
| `--workspace-panel-inset`<br>`--workspace-canvas-control-size` | ✅ `workspace.css:194` 同行内联定义（`.app-workspace` 作用域），`:497`/`:539` 有响应式覆盖 |
| 6 个 `--toast-*` | ✅ 由 `@cloudflare/kumo@2.9.2` + `@base-ui/react` **运行时注入** |

**方法缺陷自陈**: 首版正则只抓行首声明，漏了 `{ --x: v; ... }` 单行块，导致 `--workspace-*` 两个误入候选集。修正正则后自毙。此类机械扫描必须配人工定型，不能直接当结论。

---

*本报告仅为审计结论，未对代码做任何修改。除本文件外仓库保持 `git status` clean。*
