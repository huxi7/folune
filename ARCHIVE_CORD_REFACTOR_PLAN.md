# SuperNote Archive Cord 专项重构总纲

> 立于 2026-09-03。只解决 AI 整理后的归档状态、归档线、文件树可见代表与真实交互验收。
> 本文件是一次性执行总纲，不是第四份宪法。完成后归档或删除，不得被后续 Agent 当作需求来源。

## 0. 本文件的权力边界

这次重构的需求来源按下面顺序解释：

1. `PAPER_CONSTITUTION.md`：产品定律，回答为什么不能违背。
2. `app/brand-spec.md`：视觉语法，回答它应该以什么语气出现。
3. 各级 `CLAUDE.md` 与文件 L3：当前地形，回答代码现在是什么。
4. **本文件**：只回答从当前实现走到上面两份决策，分几步走、每一步如何自证。

`REFINEMENT_PLAN.md` 的其他批次与 `PAPER_REFINEMENT_PLAN.md` 的 Paper/Toolbar 决策继续有效。本文件只覆盖旧 6.3 中已经被 2026-09-03 新决策替换的三处细节：

- 「目录优先、根 memo 回退」改为「memo 永远是真实目标，目录只在折叠时充当可见代表」。
- 「目标 DOM 卸载就暂时无终点」改为「先解析最近的结构可见祖先，整条候选链都不存在时才暂隐」。
- 「离屏显示显式上/下箭头」改为「由连续曲线的切线、收细与降调表达方向」。

本轮不修改 `REFINEMENT_PLAN.md`。新产品语义已经先写入 Paper 宪法与 brand spec，本文件不得反过来发明第四套规则。

### 0.1 每次执行前的校准

每次搜索、编辑、测试、Ego Lite 浏览器验收或上下文恢复前：

1. 从头到尾重读本文件。
2. 重读 `PAPER_CONSTITUTION.md` 的第 5、6、8 节与 `app/brand-spec.md` 的 Archive Cord signature。
3. 读取目标目录 `CLAUDE.md` 和目标文件 L3；缺 L3 先补契约。
4. 查看 `git status --short`，把现有改动全部视为用户资产。
5. 写下一条本步要证明的可观察结论；不能明确落到某批就停止。

### 0.2 测试工具绑定

- 纯函数、组件、类型、Lint 与构建门禁继续使用仓库现有 Bun/TypeScript 命令。
- **所有真实页面、交互、视觉、截图、响应式、Reduced Motion、动画逐帧与性能验收，一律使用 Ego Lite（`ego-browser`）。** 不得改用内置浏览器、Playwright、Chrome 扩展或其他浏览器自动化，再把结果拼成验收证据。
- Ego Lite 使用独立 task space `supernote-archive-cord`，同一轮验收持续复用；页面是富交互工作区，视觉动作以 screenshot + 真实鼠标/滚轮为主，`snapshotText` 只辅助定位普通 DOM，`js`/`cdp` 只读取 rect、SVG attribute、animation 与性能事实。
- 每次动作后必须重新截图或读取对应的权威状态，不能仅因点击命令没有报错就判断通过；任务完成后关闭 task space，不遗留测试标签页。

## 1. 核心判断

归档线值得保留。问题不在「有一根线」，而在旧实现把三种不同概念混成了一个目标 ID：

```text
真实归档目标      这篇 memo 实际是谁
结构可见代表      当前展开状态下，用户能看见谁代表它
viewport 投影     这个代表滚出可视区后，屏幕还能指向哪里
```

旧实现用 `targetFolderId ?? memoId` 一步选完，于是目录从「容器」被误升格成「真实目标」；目录一收起或目标一滚动，代码只能在换 ID、隐藏、画箭头之间补丁式选择。

正确模型不是继续给一个 target 塞更多条件，而是把三层事实分开：

```text
AI Run / 当前树
      │
      ▼
Canonical Target       永远是目标 memo
      │
      ▼
Visible Representative memo → 最近的结构可见祖先目录
      │
      ▼
Viewport Projection    精确行 → tree 顶/底边缘
      │
      ▼
Cord Geometry          一条连续曲线
      │
      ▼
Visual Phase           fresh → settled ↔ emphasized
```

一句话总纲：

> **真相不降级，表现可以降级；对象看不见，不等于关系消失。**

## 2. 与方案 A、新讨论和当前实现的关系

### 2.1 完全重叠的部分

方案 A 与新讨论在这些地方完全一致：

- source 是 Toolbar 中稳定、可理解、可点击的归档状态，不再造空端口。
- fixed SVG Overlay 是唯一坐标空间，几何不经过每帧 React state。
- source、target、tree clip 都来自真实 DOM rect，滚动和 Panel 变化必须同步。
- 归档线在 fresh 后降为持久、低对比的 settled hairline；hover/focus 时重新提亮。
- 窄屏 overlay 不画跨层线，只保留可发现的目标反馈。
- 线的高级感来自遵守空间事实，不来自发光、弹簧、晃动、箭头或更多装饰。

### 2.2 新讨论补上的关键层

方案 A 原来只回答「选定一个 target 后，怎样稳定地画」。新讨论补上了 target 解析本身：

```text
目标 memo 的行已结构可见
  → 连 memo

某层祖先目录收起，memo 不再挂载
  → 连第一个阻断可见性的祖先目录

这个当前可见代表滚出 tree viewport
  → 连 tree 顶/底边缘
```

这里必须严格区分两个「不可见」：

- **结构不可见**：祖先目录收起，后代 DOM 不存在。解决者是 Visible Representative Resolution。
- **视口不可见**：代表 DOM 仍在，只是被 tree scroll clip 挡住。解决者是 Viewport Projection。

先解结构，再解视口。顺序倒过来，就会把「文件夹收起」误判成「目标丢失」。

### 2.3 真正发生冲突的旧规则

| 旧规则/实现 | 新结论 | 最终裁决 |
| --- | --- | --- |
| `targetFolderId ?? memoId` | memo 才是被整理对象 | memo 永远是 canonical target |
| target DOM 不存在就清空 path | 折叠时目录仍代表目标 | 先解析最近的结构可见祖先 |
| 正常/离屏都画圆点与箭头 | 曲线本身已经能表达方向 | 删除中心圆点、常驻箭头和文字提示 |
| 展开/收起后端点换位即可 | 换位会被读成跳变 | 与 tree FLIP 同一时间轴连续迁移 |
| 恢复最近 run 只恢复业务状态 | 刷新不是归档关系消失的理由 | 当前 memo 匹配时恢复 settled presentation |

这些冲突都发生在方案 A 的内部细节，不否定方案 A 的架构方向。

## 3. 冻结后的产品语义

### 3.1 Source：稳定语义起点

- source 是 Toolbar 左侧身份区的 `归档于〈末级目录〉`。
- 完整路径进入 tooltip 与 accessible name，纸上不常驻长路径。
- source 自身不画圆点、端口或 Badge；线从这个状态元素靠文件树的一侧自然长出。
- 点击 source：打开 Library、展开到目标、滚动并聚焦目标 memo。
- source 获得 hover/focus 时，与线和当前 representative 共用一个 emphasized 状态。

选择左侧不是纯审美：它回答「你在哪」，并且让线沿 Paper 与 Library 之间的留白完成最短语义闭环；放到右侧会迫使一条上下文线横穿整张纸。

### 3.2 Canonical Target：真实目标永远是 memo

- succeeded 的 canonical target 是整理结果中的 memo ID。
- undone 的 canonical target 是恢复后的 memo ID。
- 目录 ID、路径文字和当前展开状态都不得替代 memo 身份。
- memo 被移动或重命名时，候选链与显示路径从当前 memo tree 重新推导，线跟随现在的真实位置；run 只证明这条 presentation 为什么存在。
- memo 被删除、切换到另一 memo、进入其他 Workspace 或启动下一次真实 AI run 时清除 presentation。

### 3.3 Visible Representative Resolution：可见代表解析

候选链从具体到抽象排列：

```text
[memo, parentFolder, grandparentFolder, ..., rootFolder]
```

树的祖先列表由现有 `getAncestorFolderIds` 复用，不建立第二套树遍历。

解析规则：

1. 目标 memo 存在且所有祖先展开：representative = memo。
2. 从根到父目录检查展开状态；遇到第一个收起的祖先：representative = 这个目录。
3. 根级 memo 没有祖先：representative = memo。
4. memo 已不在 active tree：presentation 无效并清除。
5. tree 尚未 ready：保留 presentation，暂不画线，不连接任意替代行。

「最近的可见祖先」不是从 ID 猜，而是由真实树结构与 `expandedFolders` 纯函数推导。AppSidebar 是展开状态的所有者，因此 representative 也必须在这一层确定；Overlay 只消费唯一的 `data-archive-representative`，不在 DOM 里重新发明树语义。

### 3.4 Viewport Projection：屏幕投影

representative 选定后才判断它是否在 `.app-sidebar-tree` 的 clip rect 内：

- 行中心在安全区内：端点连接该行靠 Paper 一侧的边缘中点。
- 行逐渐接近上/下安全边缘：`y = clamp(rowCenterY, safeTop, safeBottom)`，连续贴边，没有阈值跳变。
- 行越过视口后：端点停在对应边缘，曲线末端切线继续朝真实方向收束。
- representative DOM 暂时尚未挂载：保留 presentation 与 representative ID，等待下一次 tree mutation，不假连其他行。

边缘代理不是新 target。它只是当前 viewport 对 representative 的投影。

### 3.5 Visual Phase：语气而非存亡

| Phase | 何时出现 | 表达 |
| --- | --- | --- |
| fresh | 新 succeeded/undone drawKey | 一次路径自绘＋一次极轻流光 |
| settled | fresh 结束、刷新恢复、Library 重开 | 持久低对比 hairline |
| emphasized | source/representative/hit path hover，或 source/target focus | 同一条线与目标行共同提亮 |
| hidden | Library 关闭、窄屏 overlay、其他 Workspace | 只隐藏渲染，不自动删除语义状态 |

只有新的语义结果改变 drawKey。滚动、resize、折叠、展开、Library 重开、刷新恢复都不重播 fresh。

## 4. 视觉形制

### 4.1 线

- 只使用 `--archive-cord` 与现有 Paper/Ink 语义 token，不新增品牌色。
- settled 是一根接近 hairline 的实线；具体 opacity/width 必须在真实 Light/Dark fixture 中冻结，不在业务 CSS 里散落魔法数。
- fresh 使用同一路径的 pathLength 自绘与一条极轻 flow 层；动画结束由 CSS fill state 降档，不用 timer 卸载。
- emphasized 只提高对比与必要的极小线宽，不发光、不加阴影、不换颜色、不位移。
- 曲线是单一、连续的三次贝塞尔或现有 Cord 曲线；端点变化只改变几何，没有独立摆动、噪声、弹簧、回弹或 overshoot。

### 4.2 端点

- source anchor：ArchiveStatus 靠 Library 一侧的边缘中点。
- visible target anchor：representative row 靠 Paper 一侧的边缘中点。
- clamped anchor：tree clip 的 top/bottom 安全边缘，x 仍沿 Paper-facing rail。
- 正常 visible 状态不画中心圆点、终端圆圈或箭头。
- offscreen 状态也不加显式箭头；末段曲率、切线和轻微降调足以表达方向。

### 4.3 目标行

- settled 不使用永久 Soft Ink 蓝底；它会和当前选中、拖放、搜索命中争语义。
- fresh/emphasized 可使用克制的 inset hairline 与前景色变化；不改变行高、padding、位置或树布局。
- 窄屏 overlay 只保留这套安静的 representative 行反馈。
- 当 representative 从 memo 退化为 folder 时，高亮跟随代表，不同时亮 memo 与 folder。

### 4.4 归档状态

- 可见文案：`归档于〈末级目录〉`；根目录结果使用稳定的人话标签，如 `归档于根目录`。
- 无 presentation 时整个元素不占位；出现/消失不得挤动右侧命令区。
- 它是 contextual text button，不是通用 Badge/Pill；Rest 无填充、无描边、无外影。
- hover 使用 neutral interactive-hover；focus 使用既有 focus ring。

## 5. 连续运动模型

### 5.1 滚动连续性

滚动事件只调用 `markDirty()`；同一帧最多一个 rAF。rAF 中先批量读取 source、representative 与 tree clip，再一次性写 path/hit path attributes。

`clamp()` 本身完成「可见 → 贴边 → 离屏」连续过渡，不建立会在边界切换的两套几何。

### 5.2 展开/收起连续性

AppSidebar 已使用 210ms FLIP。归档端点必须消费同一 Motion 语言：

1. 折叠前保留上一帧真实 endpoint。
2. representative 从 memo 变为 folder，或从 folder 变为更具体对象。
3. tree FLIP 活跃期间，单一 scheduler 持续读取新 representative 的真实 transform 后 rect。
4. 线头从当前绘制位置连续收敛到新 anchor；中途再次折叠时从当前点续算，不回到旧起点。
5. FLIP 结束后 rAF 自动停下，settled 页面不空转。

不得为 Cord 再发明一套相似但不同的 duration/easing。将 AppSidebar 现有 FLIP 参数上收为共享 workspace/tree motion token，树行与 Cord 同时消费。

Reduced Motion 不插值：representative 改变后直接落到新正确端点。

### 5.3 Panel Motion 连续性

Library 使用 Motion `x/opacity` Tween。ResizeObserver 看不到纯 transform，因此不能继续依赖 `transitionend` 猜结尾。

建立一个单一几何调度接口：

```text
markDirty()                 普通 scroll / resize / mutation
beginMotion(source)         tree FLIP / Panel Tween 开始
endMotion(source)           对应动画完成
```

存在任一 motion lease 时，scheduler 每帧重算；全部 lease 结束且没有 dirty frame 时停止。几何更新直接写 SVG，不进入 React geometry state。

## 6. 状态生命周期

| 事件 | presentation | representative | visual phase |
| --- | --- | --- | --- |
| 新 succeeded | 新建 | memo（成功流程先展开祖先） | fresh → settled |
| 新 undone | 替换为恢复结果 | 恢复 memo/可见祖先 | fresh → settled |
| 编辑/Autosave | 保留 | 重算当前树 | settled |
| 手动收起目录 | 保留 | memo → 最近可见祖先 | settled，连续迁移 |
| 手动展开目录 | 保留 | ancestor → 更具体对象 → memo | settled，连续迁移 |
| tree scroll | 保留 | 不变 | visible ↔ clamped 连续变化 |
| Library 关闭 | 保留 | 保留 | hidden |
| Library 重开 | 保留 | 按当前展开状态重算 | settled，不重播 |
| 页面刷新 | 当前 memo 匹配则恢复 | 按持久展开状态重算 | settled，不重播 |
| memo 被移动 | 保留 | 按当前树重建候选链 | settled |
| memo 被删除 | 清除 | null | hidden |
| 切换 memo/Workspace | 清除 | null | hidden |
| 下一次真实 AI run 开始 | 清除旧结果 | null | hidden |
| awaiting/stale/failed | 不创建 | null | hidden |

刷新恢复时不能只 `setRun`。若最近 run 是 succeeded/undone、结果 memo 仍等于当前 memo 且节点仍在 active tree，应恢复 `presentationRun`，但标记为 restored/settled；不得因为重新请求到了同一个 run 就重播 fresh 或强制展开 Library。

## 7. 实施批次

内部顺序不可打乱：**决策同构 → 纯策略 → 树代表 → 生命周期 → 几何调度 → 视觉 → 真实验收**。

### 第 0 批：决策与地图校准

目标：后续代码只有一份可执行语义。

- `PAPER_CONSTITUTION.md` 写入 canonical target、visible representative、continuous clamp、刷新恢复与无箭头原则。
- `app/brand-spec.md` 写入 source、endpoint、fresh/settled/emphasized 与窄屏表现。
- 根 `CLAUDE.md` 登记本计划。
- 不修改 `REFINEMENT_PLAN.md`；本计划明确覆盖旧 6.3 的冲突细节。

完成证明：三份文档对「到底连 memo 还是 folder」「折叠后连谁」「离屏是否画箭头」只有一个答案。

### 第 1 批：纯目标与代表策略

目标：不用 DOM 就能回答线当前代表谁。

- 在 `archiveCordPolicy.ts` 将 `resolveArchiveTargetNodeId` 改成 canonical memo 语义，或以更明确的函数替换并删除旧 folder-first 出口。
- 复用 `memoLibrary.ts#getAncestorFolderIds` 构造 `[memo, ...ancestors.reverse()]` 候选链；不复制树遍历。
- 新增 `resolveArchiveRepresentative` 纯函数，输入 active tree、memo ID、expandedFolders/treeReady，输出 memo/folder/missing 及理由。
- `WorkspaceOrganizePresentation` 只保留 run/状态/目标 memo 与展示所需路径；`targetFolderId` 不再决定连线目标。

定向测试：

- 根 memo、单层、多层嵌套。
- 全展开命中 memo。
- 最内层收起命中 parent；外层收起命中外层。
- 重开内层逐级回到 memo。
- memo 不存在与 tree 未 ready 明确区分。
- folder-first 旧断言必须删除，防止错误规则继续绿灯。

### 第 2 批：文件树代表集成

目标：树只标记一个真实 representative。

- `AppSidebar` 在现有 `expandedFolders` 所有者内计算 representative。
- 成功瞬间仍按既有语义展开祖先并定位 memo；用户随后手动收起时，不得被 effect 自动再次撑开。
- `MemoTreeBranch` 从 `highlightedFolderId/highlightedMemoId` 双目标收成单一 `archiveRepresentativeId`，只在对应真实 row 输出 `data-archive-representative`。
- `ArchiveTargetPort` 若只剩零尺寸中转意义则删除；稳定 marker 直接属于真实 row，避免一个不存在的组件继续冒充对象。
- 窄屏高亮和桌面 Cord 共用同一个 representative 标记。

定向测试：

- DOM 中代表标记永远至多一个。
- 折叠前 memo 标记、折叠后 folder 标记。
- 多层折叠只标最接近目标且仍结构可见的那个祖先。
- 用户手动收起后不会被 organize effect 反复展开。

### 第 3 批：归档 presentation 生命周期

目标：线的存在只服从语义事件。

- `useMemoOrganize` 区分新结果与恢复结果；最近 run 恢复成功时同步恢复当前 memo 的 settled presentation。
- `organizePresentation.ts` 从当前 tree 重算路径与候选链，避免 run snapshot 在 memo 移动后撒谎。
- Library 关闭/重开只切渲染可见性，不销毁 presentation。
- reload、普通编辑、autosave、tree mutation 不产生新 drawKey。
- 新 run、切 memo/Workspace、memo 删除清除。

定向测试：

- 新 success = fresh。
- 同 run reload = settled。
- Library reopen = settled。
- 编辑后仍在。
- 切 memo/new run/delete 后清除。
- awaiting/stale/failed 从不创建 Cord。

### 第 4 批：唯一几何与调度器

目标：任何运动里都只有一个坐标真相。

- `ArchiveCordOverlay` 改为读取 source、唯一 representative row 与 tree clip。
- `archiveCordGeometry.ts` 输出明确的 `sourceAnchor`、`targetAnchor`、`projection`、curve；visible target 不再返回 row centre marker。
- 删除 `markerRef`、`directionRef` 与 CSS/attribute 两套 transform。
- scroll、ResizeObserver、MutationObserver 只 markDirty；tree FLIP 与 Panel Tween 通过 motion lease 驱动逐帧重算。
- rAF 直接更新 visible path、flow path、hit path；不 set React geometry state。
- viewport/overlay 判据使用 Workspace 唯一响应式状态源，禁止在 Dashboard render 里裸读 `window.innerWidth` 形成漂移的第二真相。

几何测试：

- source/target 都落在 Paper-facing edge。
- clamp 在边界前后连续，单帧位移有界。
- representative 切换插值连续，途中切换可重入。
- 极短、极长、重合、offscreen 都无 NaN。
- Reduced Motion 直接得到最终正确路径。

### 第 5 批：视觉状态与交互

目标：刚发生时清楚，平常时克制，需要确认时随叫随到。

- drawKey 只触发 fresh pathLength 自绘与一次轻 flow；CSS 结束后保持 settled hairline。
- source、representative、hit path 的 hover，以及 source/target focus，共用一个 discrete emphasis 状态；React state可以表达这个低频语义，绝不承载 geometry。
- hit path 只在 stroke 上接收指针；点击它委托与 source 相同的定位命令。键盘入口仍由有名称的 ArchiveStatus/真实 tree row承担，不把装饰 SVG 塞进额外 Tab stop。
- 删除常驻 marker、direction arrow、目标蓝底与旧 `.organize-connection-layer` 死样式。
- Design System specimen 只消费生产组件与 token，不复制一条展示专用线。

视觉验收：

- fresh、settled、emphasized 三档一眼可分，但 settled 不抢正文。
- Light/Dark 都不出现脏灰、过亮蓝线或 Paper 上的发光划痕。
- representative 行不与 selected/search/drop 状态混淆。
- 正常目标没有中心圆点和箭头；离屏仍能只凭曲线判断方向。

### 第 6 批：真实 fixture 与 Ego Lite 验收

目标：不再用静态字符串测试宣布「体验完成」。

建立 dev-only、确定性的 Archive Cord acceptance fixture，必须复用生产：

- `ArchiveStatus`
- `AppSidebar`/真实 MemoTreeBranch 展开协议
- `WorkspaceLibraryLayer` 的 Panel Motion
- `ArchiveCordOverlay`
- 生产 CSS 与 Light/Dark/Reduced Motion

fixture 使用假 ID/假内容，不读写 API、数据库、localStorage 用户正文或真实 AI run。它至少提供：新 success、restore settled、折叠各层、展开、tree scroll、Library 开关、viewport 切换、Panel resize。

全部真实验收只能由 Ego Lite 执行：

1. 通过 `useOrCreateTaskSpace('supernote-archive-cord')` 建立并持续复用隔离空间。
2. 打开本地 fixture 后先取全页语义快照和基线截图，再开始动作。
3. 折叠/展开、hover、点击、拖动 resize handle 使用真实鼠标动作；快速滚动使用真实 wheel/scroll，不用页面脚本直接改 `scrollTop` 冒充手势。
4. 每个关键动作后重新截图；端点误差、path `d`、target marker、animation/rAF 与 React commit 证据通过 Ego Lite 的 `js`/`cdp` 只读采集。
5. Light/Dark、viewport 与 Reduced Motion 每次切换后重新读取页面状态，不复用上一档截图下结论。
6. 验收全部通过后调用 `completeTaskSpace(..., { keep: false })` 清理隔离空间。

Ego Lite 验收矩阵：

| 维度 | 必验路径 |
| --- | --- |
| 1280×720 / 1440×900 | fresh → settled、精确 memo anchor、Panel 开关 |
| Light / Dark | settled 对比度、emphasis、目标行不脏 |
| 多层树 | memo → parent → grandparent → memo 连续迁移 |
| 快速 tree scroll | visible → top/bottom clamp → visible，无跳变 |
| Panel Tween / resize | 两端逐帧同步，无 12px 落后或结束后跳正 |
| Library close/reopen | 暂隐后 settled 恢复，不重播 fresh |
| reload restore | 关系仍在，线以 settled 恢复 |
| 窄屏 overlay | 无跨层线，只有当前 representative 的安静反馈 |
| Reduced Motion | 无 draw/flow/插值，直接正确终态 |
| 鼠标/键盘 | source、target、hit path 提亮与定位语义一致 |

性能面板必须证明：

- 滚动/动画帧不产生 React commit storm。
- 同一帧至多一个 Archive rAF。
- settled 静止时没有常驻 rAF。
- 布局读取集中在写入之前，不出现 forced reflow 交错。

## 8. 文件落点

### 产品决策与 GEB

- `PAPER_CONSTITUTION.md`
- `app/brand-spec.md`
- `ARCHIVE_CORD_REFACTOR_PLAN.md`
- 根 `CLAUDE.md`
- `app/CLAUDE.md`
- `app/src/pages/CLAUDE.md`
- `app/src/widgets/CLAUDE.md`
- `app/src/styles/CLAUDE.md`
- 所有改动文件 L3

### 语义与生命周期

- `app/src/pages/organizePresentation.ts`
- `app/src/pages/useMemoOrganize.ts`
- `app/src/pages/AppDashboard.tsx`
- `app/src/widgets/archiveCordPolicy.ts`
- 对应 tests

### 树与代表

- `app/src/widgets/AppSidebar.tsx`
- `app/src/widgets/MemoTreeBranch.tsx`
- `app/src/widgets/memoLibrary.ts` 只复用/必要时扩展既有祖先能力
- `app/src/widgets/ArchiveCord.tsx`
- 对应 tests

### 几何、调度与表现

- `app/src/widgets/ArchiveCordOverlay.tsx`
- `app/src/widgets/archiveCordGeometry.ts`
- `app/src/pages/workspaceMotion.ts`（只上收既有 tree FLIP 参数）
- `app/src/widgets/WorkspaceLibraryLayer.tsx`
- `app/src/styles/workspace.css`
- 必要时 `app/src/styles/cord.css`，只复用 Cord signature，不改 Canvas 正式边
- 对应 tests 与 dev-only fixture

## 9. 明确不做

- 不改 `api/`、`chat/`、数据库、AI organize workflow、审批协议或工具 schema。
- 不改 Canvas WAL、mutation、viewport、节点、正式 `CanvasCordEdge` 或临时连接绳。
- 不重写文件树 DnD、搜索、重命名、创建或展开偏好存储。
- 不借机重排整个 Toolbar；本轮只校准 ArchiveStatus 文案/source 契约。
- 不新增颜色、发光、箭头、终点圆圈、Badge、Toast 或第二套路径算法。
- 不为验收运行真实 AI、移动真实笔记或修改真实用户正文。
- 不提交 commit，除非用户另行明确授权。

## 10. 失败模式清单

1. **把 representative 写回 presentation。** representative 是当前视图投影，不是业务事实；写回后折叠一次就会篡改 target。
2. **Overlay 自己遍历树猜父级。** expandedFolders 的所有者是 AppSidebar；跨层再猜一次必然形成两个答案。
3. **folder-first 换成 memo-first 就宣布完成。** 没有结构代表解析，折叠时只会从「永远连目录」变成「永远断线」。
4. **用目标 DOM 是否存在同时判断折叠与离屏。** 折叠是结构问题，滚动是 viewport 问题，必须先后分层。
5. **给 representative 切换加 spring。** 线的生命感来自连续事实，不来自晃动；只用与 tree FLIP 同源的克制 Tween。
6. **每帧 setState。** hover/focus 可以走离散 state，geometry 只能留在 rAF + refs + SVG attributes。
7. **让 settled 页面常驻 rAF。** 没有运动就不读布局；无为比优化一个永远运行的循环更正确。
8. **用 timer 隐藏线或重置 draw。** fresh 可以结束，关系不能因时间结束。
9. **用显式箭头补几何说不清。** 曲线若不能表达方向，先修路径与切线，不再叠一层说明书。
10. **只跑静态字符串测试。** `toContain("requestAnimationFrame")` 不能证明端点跟手；没有真实 fixture 就没有交付资格。

## 11. 完成门禁

每批遵循：

```text
重读总纲
→ 读取 CLAUDE/L3
→ git status
→ 最窄纯函数/组件测试
→ typecheck + lint
→ 对应 Ego Lite 真实 fixture 验收
→ 同批 GEB 回环
→ diff 范围复核
```

最终交付必须同时具备四类证据：

1. **代码**：canonical target、representative、projection、visual phase 职责分离；旧 folder-first/marker/arrow/dead CSS 删除。
2. **测试**：定向策略、组件、生命周期、几何连续性全绿；`bun test`、`bun run typecheck`、`bun run lint`、`bun run build`、根 `git diff --check` 全绿。
3. **运行时**：每帧一个 rAF、无 React commit storm、无 forced reflow 交错、静止零空转。
4. **真实交互**：多层折叠、展开、快速滚动、Panel Tween、关闭重开、reload、窄屏、Dark、Reduced Motion 全部由 Ego Lite 在假数据 fixture 中通过，并保留动作后的截图与几何/性能读数。

只完成前三类中的任意三类都不算完成。尤其禁止再次用「代码有了、测试绿了、真实成功 presentation 没跑」宣布交付。

## 12. 最终验收问题

任何实现必须逐条回答「是」：

- 用户是否能从 `归档于〈目录〉` 一眼理解这根线为什么存在？
- memo 行可见时，线是否精确连接 memo 而不是目录？
- 收起一层或多层目录时，线是否连接当前最近的可见祖先？
- 重新展开时，终点是否连续回到更具体对象，最终回到 memo？
- representative 滚出 tree viewport 时，是否连续贴边且无需箭头仍能读出方向？
- 整个过程中 canonical target 是否始终是同一个 memo？
- fresh 是否只播放一次，settled 是否持续、安静且可重新提亮？
- 刷新与 Library 重开是否恢复 settled，而不是消失或重播成功？
- 快速滚动、tree FLIP、Panel Tween、resize 时，端点是否没有落后一帧与结束跳正？
- 窄屏是否完全没有跨层划痕，只保留正确 representative 的安静反馈？
- Reduced Motion 是否立即呈现正确终态而不丢信息？
- 静止页面是否没有常驻测量循环，滚动/动画是否没有 React commit storm？

全部回答「是」，Archive Cord 才不再是一根画出来的线，而是一条始终遵守空间事实的产品语言。

[PROTOCOL]: 变更时更新此文件，然后检查 PAPER_CONSTITUTION.md、app/brand-spec.md 与根 CLAUDE.md
