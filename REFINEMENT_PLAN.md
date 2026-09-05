# SuperNote 形制收口 · 实施总纲

> 框架文件：原始批次、依赖与判断保持不变；本次经批准只在各节点下补充执行细节，不新增产品语义，不列易漂移的行号。
> 立于 2026-09-01。**它是实施总纲，不是第四份宪法。** 本轮收口完成后应当删除或归档；任何人不得从本文件推导需求。

## 0. 本文件是什么，不是什么

| | 回答什么 |
| --- | --- |
| [CANVAS_CONSTITUTION.md](CANVAS_CONSTITUTION.md) · [PAPER_CONSTITUTION.md](PAPER_CONSTITUTION.md) | 为什么不能。**唯一的需求来源** |
| [app/brand-spec.md](app/brand-spec.md) | 已选的视觉规格与被否决的候选 |
| 各级 `CLAUDE.md` · L3 头部 | 现在是什么 |
| [PAPER_REFINEMENT_PLAN.md](PAPER_REFINEMENT_PLAN.md) | 2026-09-02 Paper 二次形制收口的新决策交接：开本高度优先、Quiet Accent、Toolbar 顺序、sticky 线性凝结、全局 press。它已按自身第 0 批把结论写回上面三份决策文档，因此本文件第一批与 6.1/6.2 以它为准 |
| **本文件** | 这一轮从上面三者走到代码，分几批走、每批最容易在哪失手 |

本文件不新增任何产品语义。若实施中发现需要一条三份决策文档里没有的规则，那是一次新的产品决策：先回去改那三份，再回来改这里，顺序不得倒置。倒置一次，宪法就退化成事后追认。

### 0.1 强制校准协议

后续所有执行都从本文件重新起步，不依赖对话记忆：

1. 每次准备搜索、编辑、运行测试、打开浏览器验收或继续一个被压缩过的上下文前，先从头到尾重新读取本文件。
2. 读取后只选择当前批次允许的文件和命令；若准备做的事无法明确落到某一批，立刻停止，不用「顺手」扩范围。
3. 当前批次完成前，不预做下一批的投影文档；第四批内部同样严格按 6.1 → 6.2 → 6.3 推进。
4. 任何来自旧对话、旧截图、Memory 或历史计划的说法，若与本文件不一致，一律作废；只有本文件引用的两份宪法与 `brand-spec.md` 可以解释这里的简写。
5. 发现实现现实与本文件冲突时，先判断是实现走偏还是产品决策缺失。实现走偏就修实现；决策缺失就停下回到决策文档，不得在代码里暗自补规则。

### 0.2 每次落刀前的最小检查

- 重新读取目标目录的 `CLAUDE.md` 与目标文件 L3 头部；缺 L3 先补契约再继续。
- 查看 `git status --short`，把已有改动视为用户资产；只编辑当前批次明确列出的文件，不覆盖无关 diff。
- 先写下本次要证明的一个可观察结论，例如「搜索与新建同为 12px」「点击连接柄不打开 Palette」，然后再改代码。
- 改完先跑最窄测试，再扩大到批次门禁；测试失败时只在当前批次内修复，不跨批绕过。

## 1. 统一命题

六处改动不是六件小事，它们是**同一个问题的六个面**：

```text
形没有表达语义
├─ 圆角        没有表达「润」——半径不够，而 squircle 又把它往方推了一档
├─ 图标        没有表达「不同的事」——一个字形担着三个命令
├─ 连接        没有表达「拉一根线」——它弹出了一个搜索框
├─ 纸          没有表达「一张纸」——它只有顶天立地，没有比例
├─ 核心命令    没有表达「名词 vs 动词」——两个双胞胎并排
└─ 归档线      追不上它所描述的事实——选型与需求不匹配
```

所以本轮的验收不是「功能可用」，而是**形与语义同构**。这正是 GEB 那条要求在界面层的同一句话。

## 2. 四批与它们的依赖

```text
第一批  设计系统的两条公理        ← 全局前置，后面每一批都用它的产出
   │
   ├──→ 第二批  命令的形制
   │
   ├──→ 第三批  连接的直接操纵
   │
   └──→ 第四批  纸与它的落点      ← 内部严格有序：开本 → 顶栏 → 线
```

第一批必须最先，因为后面三批都要造新控件，新控件得先有正确的曲率与字形可用。第二、三批彼此独立，可并行也可任意先后。第四批内部不可打乱：**先有纸，才有纸上的命令，才有命令留下的痕迹**——线的起点住在顶栏的状态元素里，那个元素在顶栏那一步才出现。

### 2.1 批次通用门禁

每批都按同一条小循环完成，不把验证堆到最后：

```text
重读本文件
→ 读取目标 CLAUDE/L3
→ 现状与测试定位
→ 最小实现
→ 纯函数/组件测试
→ typecheck + lint
→ 对应真实界面验收
→ 同批更新 GEB 投影
→ diff 范围复核
```

一批只有同时满足下面四项才算完成：代码事实成立、测试锁住回归、真实界面可见、文档投影与代码同构。只完成其中三项不得进入下一批。

## 3. 第一批 · 设计系统的三条公理

**解什么**：一个 token 只说一件事，一个字形只说一件事，一次按下只有一种触感。

**触及面**：语义 token 层、图标注册表与全局命令按钮的 press 状态；不触碰任何交互逻辑。

### 可直接执行的步骤

1. **先做消费者清单。** 从 `app/src/index.css` 的 Radius token 出发，搜索 `--radius-control`、`--radius-inner-control`、`--button-radius`、直接写死的 `10px/0.625rem`，列出 Button、Input、Select、SidebarButton、UserButton、Command Palette、Canvas chrome 的实际消费者。只登记，不先逐个覆盖。
2. **整档移动 Control。** 在 `app/src/index.css` 把 Control 从 10px 改为 12px，保持 Compact/Paper/Menu/Panel/Dialog 不变；`--button-radius` 继续引用 Control，不创建 Button 私有半径。检查 Light/Dark 是否共读同一 token，禁止主题分叉。
3. **把 inner radius 从公式变成已冻结结果。** 先让 `--radius-inner-control` 使用一个候选显式值，在 Design System 里同时摆出 Button 的内亮环、Input/Select 的内层、复合输入的嵌套。以 100% 和 125% 浏览器缩放检查四角是否同心；选定后把数值冻结成明确 token，并在样板与测试里记录，不能留下「运行时靠眼睛」的隐形规则。
4. **建立语义图标别名。** 在 `app/src/shared/design-system/icons.tsx` 注册加入、ZoomIn、ZoomOut、连接抓手、AI 整理、AI 拓展各自的稳定语义出口。业务组件只引用语义名，不直接引用 Lucide；`PlusIcon` 与 `MagicWandIcon` 可继续服务真正同义的旧场景，但不得再跨这六个语义复用。
5. **先在 Design System 选字形，再替业务。** 更新 `DesignSystemWorkspace/iconCatalog.ts` 与图标陈列，把收拢型整理和发散型拓展并排放在 14/16px、Light/Dark、Primary/Secondary 上比较。整理与拓展必须得到两个不同的语义别名；实际业务替换分别放到第二/三/四批，避免第一批顺手改交互组件。
6. **全局视觉巡检。** 至少检查 Library 搜索/新建同排、账户表单、Select、Dialog 按钮、AI Composer、Canvas 控件、Design System Radius specimen。Composer 的发送/停止圆键必须仍显得是唯一几何圆形，不能被 12px Control 稀释。
7. **冻结证明。** 更新或新增 Radius/组件 CSS 契约测试，确认 Control 为 12px、Button 没有私有半径、Composer 仍显式 `corner-shape: round`，并让 Icon Catalog 覆盖所有新增语义出口。

### 第三条公理 · 全局 press 收口（2026-09-02 追加）

按钮看起来必须在原地「收紧」，不是向下掉一格。`translateY(1px)` 在 32px 控件上读作掉格，而且每个组合控件各写一遍，于是「按下是什么感觉」有四五个答案。

1. 先做消费者清单：搜索 `translateY(1px)`、`translateY(0.0625rem)` 与孤立 `scale(0.94)`，只登记真正的命令控件（`.ds-button`、Sidebar create split、EdgeDock、Toolbar icon button）。Panel、拖拽预览与布局动效不属于本批。
2. 在 `app/src/index.css` 暴露一个统一的 press 缩放 token，让四处共读一个值；不允许任何控件私藏第二个数值，也不新增 bounce/overshoot 曲线。
3. Active 以中心为原点缩放、约 70ms，释放走现有 fast/standard token 回位；hover 永远 `transform: none`。
4. pressed shadow 继续使用现有压缩态，各变体消费自己的表面 token，不复制色值。
5. split 必须整个外壳一起缩放，不能左右两半分别动；loading、disabled 不缩放；键盘 Space 按住得到等效 pressed 反馈，focus ring 始终可见。
6. Reduced Motion 取消缩放，保留 active 色、边界与阴影压缩。
7. 用静态契约锁住：命令控件不再出现按压位移，四处共读同一个 token，Reduced Motion 有静态替代。

### 文件落点

- Token 与视觉：`app/src/index.css`、`app/src/styles/button.css`、`app/src/styles/sidebar-button.css`、`app/src/styles/workspace.css`、必要时 `app/src/styles/design-system.css`。
- 图标真相：`app/src/shared/design-system/icons.tsx`、`app/src/widgets/DesignSystemWorkspace/iconCatalog.ts`、`app/src/styles/design-system-workspace.css`。
- 投影：`app/src/styles/CLAUDE.md`、`app/src/shared/design-system/CLAUDE.md`、`app/src/widgets/DesignSystemWorkspace/CLAUDE.md` 及上述文件 L3。

### 本批验证

- `bun run typecheck` 与 `bun run lint` 先证明 token/别名没有破坏调用方。
- 运行 Design System、Button、基础可访问性相关测试；没有覆盖 Control token 的测试就先补最小静态契约。
- 用 `/app` 与 `/design-system` 的真实 DOM 读取 computed `border-radius/corner-shape`，同时截图 Light/Dark。不能只看 CSS 文本就宣布「更润」。

**最容易做错的地方**

1. **以为把半径改大就完了。** `corner-shape: squircle` 是 `superellipse(2)`，同半径下比默认圆弧更方。改完若仍嫌方，正确的下一步是继续提半径，**绝不是提高 superellipse 值**——那个方向通向直角。
2. **给 Button 开私有 token。** 这是实施时最自然的偷懒，也是被明文禁止的：Library header 里搜索 Input 与新建 Button 并排，2px 之差正是「说不出哪里怪」的来源。整档一起走。
3. **用减法公式算内层同心半径。** 换过曲线之后减法不再保证干净嵌套，内层只能靠眼睛定。
4. **图标只换一处。** 复用是成片的：一个字形担着「加入笔记 / 放大 / 关联」三个命令，另一个字形同时担着两个语义相反的 AI 动作。要么全部拆开，要么这一批没做完。

**完成锚点**：`brand-spec.md` 的 Radius system 与 Iconography 两节可以逐条对着界面点头，且其中「已批准待实施」的标注可以摘掉。

## 4. 第二批 · 命令的形制

**解什么**：按钮该长什么样、该和谁站在一起。

**触及面**：侧栏新建控件、Canvas 底部控制区；不触碰数据流。

### 可直接执行的步骤

#### 侧栏新建 split

1. 在 `SidebarCreateMenu.tsx` 删除主区的 NotePencil 图标及其 import，保留「新建」文字、默认创建 memo 的回调和现有 aria-label/title。
2. 从下拉菜单删除重复的「新建备忘录」项与 `FileTextIcon`，只留下 Canvas、文件夹；菜单键盘逻辑仍按实际两项计算，复测 ArrowUp/Down、Home/End、Escape、外点关闭和触发器焦点归还。
3. 在 `workspace.css` 把 split 外部高度维持 32px，主区固定约 48px、更多区固定 32px，总宽约 80px；外壳共用 12px Control squircle，内部接缝仍只有一条低对比分隔线。不要给左右两块各造完整圆角，也不要改搜索所在的 grid 轨道。
4. 让 split 复用 Primary Button 的边界、面光和 press 语义；若现有 Button token 无法被组合消费，只暴露材质变量，不复制一套具体色值/阴影。
5. 验证搜索打开前后 `[搜索] [新建 │⌄]` 一行完全不跳动，新建按钮不隐藏、不扩张、不因菜单开合改变宽度。

#### Canvas 底部控制区

1. `CanvasControls.tsx` 仍只用一个 React Flow `Panel` 负责 bottom-center 定位，但 Panel 内改成两个真正独立的视觉表面：内容动作组与视口动作组。外层定位壳不得自己再画第三层卡片背景。
2. 内容动作组只放稳定 Tonal 的 `FilePlus + 加入笔记`；尺寸与材质不读取节点数量，不存在「空 Canvas Primary / 有节点 Tonal」分支。
3. 视口组保持适配、缩小、放大、说明的顺序，分别使用 Fit、ZoomOut、ZoomIn、Info；裸 Plus/Minus 不再承担缩放语义。
4. `加入笔记` 继续调用当前唯一 Command Palette 入口与已登记的 Canvas adapter，不创建第二个 Picker、不改变 Enter/Tab/⌘Enter 的既有键盘合同，也不改任何 memo API。Palette 结果行中表达「加入」的图标同步使用加入语义别名。
5. 更新 `.canvas-controls` 为纯定位/排布壳，新建两个 group 样式各自拥有边界、背景、12px曲率和同高；两组之间使用 8–12px 留白，不用竖线。重新核对 `.canvas-mode-notice`、窄屏保存状态与底部 safe area，不能因为拆组让提示层压住按钮。
6. 空画布提示文案明确指向可见的「加入笔记」和空白双击，不把 ⌘K 当唯一首步；已有画布不改变这颗按钮的材质或位置。

### 文件落点

- Sidebar：`app/src/widgets/SidebarCreateMenu.tsx`、`app/src/widgets/AppSidebar.tsx`、`app/src/styles/workspace.css`。
- Canvas controls：`app/src/widgets/KnowledgeCanvas/CanvasControls.tsx`、`app/src/widgets/KnowledgeCanvas/KnowledgeCanvas.tsx`、`app/src/styles/knowledge-canvas.css`。
- 单一 Command Surface 回归：`app/src/widgets/WorkspaceCommandPalette.tsx` 与现有测试；只换语义图标，不重写搜索状态机。

### 本批验证

- 给 `SidebarCreateMenu` 增加结构/键盘测试：主按钮仍建 memo，菜单恰好两项，焦点环不丢。
- 给 `CanvasControls` 增加 DOM 结构测试：两个 surface、一个 Panel、加入按钮始终 Tonal、视口动作顺序稳定。
- 复跑 `WorkspaceCommandPalette.test.tsx`，证明底部入口没有引入第二套 open/add 状态，也没改变连续加入与 IME 合同。
- 浏览器验收至少覆盖 1280px 桌面、窄屏断点、Light/Dark：split 的 48/32 比例、两组 Canvas Controls 的视觉重量、空 Canvas 首步可发现性都必须实际看。

**最容易做错的地方**

1. **把新建按钮提到 36px。** 侧栏整条是 32px 体系（搜索、命令、edge dock、树行都是），提高它会让最高频的动作单独凸出来，破坏那一行的水平节奏。
2. **菜单里保留「新建备忘录」。** 主区标签已经是「新建」且默认建备忘录，菜单再列一遍是同一句话说两遍。删它属于**代码回归宪法**，不需要改宪法。
3. **用分隔线把底部五项包成一组。** 分隔线表达「同一个东西的两个部分」，留白表达「两个东西」。加入笔记与视口动作是后者。
4. **让加入笔记在加进第一篇后自动降级。** 已否决：在一次成功之后立刻让按钮变淡，是把奖励换成衰减；空状态的引导交给首屏低对比提示。

**完成锚点**：Canvas 宪法 11.1；`brand-spec.md` 的 Radius 与 Iconography。

## 5. 第三批 · 连接的直接操纵

**解什么**：把「建立关系」从搜索框还给手。这是本轮唯一涉及新交互模型的一批。

**触及面**：卡片的元信息行与新的连接柄、拖拽会话、临时线渲染层；正式关系仍走既有 WAL 与保存协调器。

### 可直接执行的步骤

1. **先把连接判据收成一个纯函数。** 从当前 `onNodeClick` 与 edge 创建分支提取「memo_ref、非自身、非墓碑、无重复 pair」判据，点击和拖拽必须共用；失败返回可区分原因，UI 据此显示 invalid，而不是两个入口各写一套 if。
2. **删除错误入口，不删除等效路径。** `canvasActions.onConnect` 只负责 `startConnection(nodeId)`，移除 `openPalette()`；元信息行删除「关联」按钮。保留 `connectionSourceId + onNodeClick + Esc` 作为点击路径，并让连接提示只描述「选择另一张卡片」，不再提搜索。
3. **把右下抓手作为卡片直接子元素。** 在 `CanvasCardNode` 的 memo_ref 分支渲染一个可聚焦、带 aria-label/tooltip 的 React Flow source Handle，使用 Grip 语义图标或等价 CSS 图形，骑在右下圆角且标记 `nodrag`。它跟随 `.canvas-card-actions` 的 hover/focus/selected 显形，但不能占 footer 布局宽度，也不能改变 React Flow measured rect。
4. **建立整卡 target。** 为可连接 memo_ref 提供透明的 whole-card target Handle；只在连接会话中开放 pointer hit，层级放在正文交互之下，避免遮住预览、AI、移除。将 `nodesConnectable` 打开，但 `isConnectable` 仍由节点可用性控制，native text、墓碑与已删除目标不得变成落区。
5. **接入 React Flow 连接生命周期。** 使用 `onConnectStart/onConnect/onConnectEnd/isValidConnection`：开始时记录纯 UI 手势并隐藏抓手；连接成功时只签发一次 `connect` receipt 并通过现有 `enqueue({ upsert_edge })` 落 WAL；结束或取消时清空瞬态状态。防止一次拖拽结束后浏览器再合成 click，导致意外进入点击模式。
6. **目标反馈只改轮廓。** 合法目标在拖拽和点击模式下共用 1px Soft Ink 线与极淡外环；禁止背景、位移、缩放和 layout 变化。无效目标保持普通表面，但连接线头/指针给出无效语义。
7. **把临时绳索独立成纯 UI 模块。** 新建 `CanvasElasticConnectionLine.tsx` 和纯几何 `elasticCordGeometry.ts`（名称可按目录范式调整）：中心骨架严格连接源边界与实时指针；2–3 股路径使用相位错开的正弦法向扰动，并用端点包络保证两端汇聚。
8. **参数集中，不散魔法数。** 几何层集中定义 near/far 距离、最大/最小振幅、股距、线宽、波数与相位速度；先由 `tension = clamp((distance - near) / (far - near), 0, 1)` 推导，拉远时振幅/股距/线宽单调收敛。时间只推进形态相位，不参与指针坐标。
9. **线头空心环跟随真实指针。** 圆环是 drop cursor，不参与端点几何；命中合法目标时只收紧尺寸/提高对比，不能把目标吸向指针或改变连接坐标。
10. **rAF 只服务一根瞬态绳。** 组件挂载时以 rAF 直接更新 path `d` 和线头位置，卸载立即 cancel；端点 props 写入 latest ref，避免每帧 React state。Reduced Motion 下停掉相位推进，保留严格跟手的静态细绳与合法目标反馈。
11. **冻结正式线。** `CanvasCordEdge` 的 width、taper、tone、曲线与理由/删除命中区不改；临时绳卸载后，只让现有 edge-draw receipt 自绘正式线，不增加宽度归一、回弹或第二次过渡。

### 状态机门禁

| 状态 | 抓手 | 临时绳 | 目标卡 | 持久写入 |
| --- | --- | --- | --- | --- |
| idle | hover/focus/selected 时可见 | 无 | 普通 | 无 |
| click-armed | 来源柄保持选中语义 | 无 | 合法目标细边/外环 | 点击合法目标时一次 |
| dragging | 来源柄隐藏 | 单根编织绳，严格跟手 | 合法目标细边/外环 | 松手合法目标时一次 |
| cancelled/invalid | 恢复 | 立即销毁 | 立即恢复 | 零 |
| connected | 恢复 | 销毁 | 恢复 | 现有 WAL + receipt |

### 文件落点

- 卡片与动作：`CanvasCardNode.tsx`、`canvasActions.tsx`、`KnowledgeCanvas.tsx`。
- 瞬态渲染：KnowledgeCanvas 目录中新建连接线组件与纯几何文件，样式进入 `knowledge-canvas.css`。
- 正式线：`CanvasCordEdge.tsx`、`Cord.tsx`、`cordGeometry.ts` 只作为复用/回归参照，不借机重构。

### 本批验证

- 纯几何测试：两端永远汇聚、距离增加时振幅/股距/宽度单调下降、零距离和极远距离不产 NaN、Reduced Motion 路径稳定。
- 组件测试：右下柄是卡片直接子元素，元信息行只剩 AI 拓展/移除，拖拽时柄隐藏，whole-card target 不遮挡卡片动作。
- 交互测试同时覆盖拖与点：合法连接只写一次 WAL/upsert_edge；自连、重复、墓碑零写入；Esc 取消；连接入口打开 Palette 的次数恒为 0。
- 真实浏览器用同一测试 Canvas 连续做「拖成功 → 点击成功 → Esc取消 → 无效自连」，再移动两张卡片确认正式浮动端点仍按原几何换边；不使用真实用户内容做测试数据。

**最容易做错的地方**

1. **把柄做成端口。** 柄是抓手：拖拽一开始它就该消失，线从卡片边缘长出来，不是从那个小圆点长出来。柄在拖拽中还挂着，用户下一秒就会看到线从另一条边出来，那一帧的不一致会被读成 bug。
2. **为了「完整」做四边柄。** 端点由两卡中心射线求交，柄与端点解耦，所以一个就够。四边端口只在柄本身就是端点的产品里必需。
3. **给临时线的坐标加弹簧延迟。** 摆动是**形态**，不是坐标的粘滞。坐标必须严格跟随指针，加延迟会毁掉直接操纵的手感。
4. **把临时线的物理特征带到正式线上。** 正式关系线一个字不改。理由不是省事：关系线是复数，宽度随距离变会让整张图跟着呼吸。
5. **让临时线进持久层。** 它是纯瞬态对象：不进 WAL、不进关系模型、不参与保存，松手即销毁；正式线的出现沿用既有画线回执，不另造过渡。
6. **以「简化交互」为名砍掉点击路径。** 那是 WCAG 2.5.7（AA）的硬要求，不是体验偏好。

**完成锚点**：Canvas 宪法 6、10.2、10.3，以及第 14 节新增的两问——卡片上建立关系的入口是否绝不打开搜索面板、任何拖拽连接是否都有等效单指针路径。

## 6. 第四批 · 纸与它的落点

**解什么**：让纸成为一张纸，让纸上唯一的核心命令有它应得的层级，让那个命令留下的痕迹咬住事实。

**内部顺序不可打乱**：开本 → 顶栏与命令层级 → 归档线。

### 6.1 开本（2026-09-02 改为高度优先）

#### 可直接执行的步骤

1. 在 `workspace.css` 让 Paper 的几何所有者变成高度优先：`paperHeight = 100vh - 2 × --workspace-panel-inset`，`paperWidth = paperHeight × 7 / 9`，**移除 816px/51rem 宽度上限**。7:9 仍是 CSS 里唯一那份形状真相，短文由重叠比例基线立成纸，长文由真实正文撑长同一条 grid track。
2. 舞台上下留白改为与 Panel 同一条内缩线，使初始状态下 `padding-top + paperHeight + padding-bottom` 恰好等于视口高：空/短笔记的 `scrollHeight` 不得超过 `clientHeight + 1px`。
3. 顺着 flex/grid 向内检查 `.paper-content-transition`、`.notes-workspace`、`.note-editor-canvas`，不得出现第二条 viewport 公式把纸重新撑高；正文列宽与 padding 保持原值，绝不为了填满更宽的纸拉长行长。
4. `--paper-max-width` 若已无真实消费者，就连同 token 一起收走；留着它等于给主 Paper 留了一条随时会回来的暗中钳制。
5. compact fallback 由容器几何触发：`min()` 让可用宽度在装不下时自动接管，放弃精确底边对齐但绝不横向裁纸；不得用断点数字近似这个条件。
6. 窄屏 media query 显式取消固定比例并继续使用可用视口与现有紧凑 padding，不制造 Paper 与 stage 双重滚动。
7. `NotePaper reader` 的 `1:√2`、内部滚动、40rem 约束一个字不改；Canvas memo 的 280×360 也不改。
8. 检查 Paper↔Canvas/Card↔Preview 视图过渡：比例改变只能改变纸壳取景，正文仍按原尺寸淡换，不能重新引入文字缩放或重叠。

#### 验证

- 增加 CSS 契约：桌面主 Paper 由高度反推 7:9、没有宽度上限、比例基线不参与列定宽；reader 仍为 1:√2；窄屏覆盖取消比例。
- 浏览器在 1280×720、1440×900、1920×1080 与窄屏读取 Paper 实际 rect，对照 `PAPER_REFINEMENT_PLAN.md` 2.5 的表（±1px）；短笔记 `scrollHeight ≈ clientHeight` 且滚轮不改变 `scrollTop`，长笔记只有 `.paper-stage-scroll` 滚动。
- 用短/长/空三种 fixture 检查标题、正文列宽、自动保存与编辑器选择不因几何改动重挂载。

**最容易做错的地方**

1. **把纸宽与行长绑在一起。** 两者独立：纸的比例服务美感，正文列宽服务可读。绑在一起会让「纸好看」和「字好读」互相勒索。
2. **高度优先还留着 816px 上限。** 较高视口会因此重新失去底边对齐，等于同时维护两条互相冲突的几何真相。
3. **用 React/resize state 每帧算宽高。** 这是 CSS 能表达的东西；交给 JS 就等于把一份几何真相拆成两份。
4. **为了统一比例把阅读预览也改掉。** 两者现在都由高度定形，但不是同一个对象：写作纸与 Canvas 卡片必须同比例，阅读纸是临时的模态 ISO 纸。

### 6.2 顶栏与命令层级

#### 可直接执行的步骤

1. **先重排数据，不先做视觉。** 在 `AppDashboard` 停止为 Paper 拼接文件夹路径；把 `currentMemoTitle`、`organizePresentation`、进入 Canvas/返回 Canvas/整理回调作为明确 props 传给 Paper 工具栏。辅助页面仍保留自己的标题，不套用 memo 的 sticky 逻辑。
2. **改造 `AppMainToolbar` 为稳定四区。** 左侧只保留真实返回 Canvas、归档落点与滚动后出现的 memo 标题；右侧命令区顺序冻结为 `整理笔记 → Canvas → 阅读/编辑 → 更多`，四个相邻命令统一使用 8px 留白。动作按钮 DOM 槽位固定，loading、标题淡入、归档状态出现都不得让右侧换位。`[2026-09-04 决策]`
3. **新增归档状态元素。** 建议独立为小组件，输入只接受 `presentation.path/targetFolderId/memoId/status` 与定位回调；显示末级落点，完整路径进 tooltip/accessible name；点击时打开文件库、展开路径并聚焦真实目标行。它同时暴露稳定 source ref/data attribute 给 6.3，自己不画线。
4. **编辑不清状态。** 状态继续消费 `organizePresentation`，不订阅逐键正文；内容 revision 变化最多把动作文案改为「重新整理」，不能删除 presentation、自动启动模型或改变线的起点。下一次真实 AI run 开始时再由既有 run status 清掉旧 presentation。
5. **整理按钮升为唯一核心动作，材质是 Quiet Accent。** 带语义图标与文字、36px hit geometry，静止无背景/边框/外影，hover 只浮出极淡 `primary-soft`，loading 才允许凝结成 Processing 实体；继续复用 `⌘/Ctrl+Enter`。**不使用 Filled Primary，也不新增通用 Button variant**——在 `.note-organize-button` 上消费现有 primary/primary-soft/Processing token。「进入 Canvas」收成 32px 无标签 Ghost 图标，与视图开关同重量且永不顺带调用拓展 API。`[2026-09-02 决策]`
6. **阅读/编辑只表达状态。** 复用 `MarkdownViewMenu` 既有状态源与菜单焦点合同，为当前阅读/编辑入口增加 neutral hover 与 Soft Ink 模糊下划线；More、复制、导出仍住原菜单，不新增第二份 documentView/editingMode 状态。
7. **做 sticky 而非 fixed，且钉在 Panel 内缩线上。** `.app-main-toolbar` 在 `.paper-stage-scroll` 内 `position: sticky`，`top` 是 `--workspace-panel-inset` 而不是 `0`，层级高于正文但低于 Dialog/Panel；静止阶段透明、无边无影。原生 scroll timeline 在 24–80px 严格 `linear` 地显出不透明 Paper 实底（锚在顶栏下沿向上长满「顶栏 + 一条 inset」，因此顶栏上方那条留白里只有纸），36–80px 只淡入标题、不做位移；回顶沿同一路径融回。本条原写 40–96/52–96 且要求出现 hairline，两者均已由 PAPER_CONSTITUTION.md §4.2/§4.3 废弃——那个终点晚于正文抵达顶栏下沿的时刻，而那条底边线会把顶栏读成一个随滚动变宽的物体。不支持 scroll timeline 时只用一个 sentinel + `IntersectionObserver` 软切 `data-condensed`。Reduced Motion 取消位移但保留与滚动对应的浓淡。`[2026-09-02 决策]`
8. **防正文穿透。** 凝结后的背景必须使用不透明 `paper-surface`，不能用会让字透出的玻璃；不画 hairline（§4.2），边界只由下缘软边表达。工具栏高度固定，切换状态、loading、路径长短都不得改变纸内正文起点。
9. **移除旧路径 props 与样式。** 删除 `toolbarTitle` 的 memo 路径拼接、`/` 装饰及不再使用的 class；保留辅助页面自身标题路径，避免一次重构波及 Trash/Subscription/Design System。

#### 验证

- 组件测试：整理按钮始终是独立动作；归档状态是另一个元素；编辑正文后状态仍在；进入 Canvas 只调用导航回调。
- 状态/菜单测试：阅读↔编辑的 aria 状态、键盘焦点与柔光只落当前态；More 菜单合同不变。
- 浏览器长笔记连续滚动：标题离开时顶栏凝结，回到顶部时完全融回纸；检查无正文透字、无1px跳动、无按钮换位。
- 验证从 Canvas 返回、整理成功、编辑后重新整理、关闭/打开左右 Panel 四条路径，工具栏都保持同一几何。

**最容易做错的地方**

1. **静止时就画出那条底边线。** 静止时顶栏不该是一个物体。能在不需要时不存在，是它相对于浮层的唯一决定性优势；一画线就把这个优势丢了。
2. **sticky 贴到 `y=0`。** 那一刻顶栏已经爬出纸面贴住窗口边缘，不再是「纸的上边距」，而是宪法第 7 节明文不做的浮层。
2. **sticky 忘了背景。** 现在这一行是透明的，钉住之后会直接透出正文。
3. **把状态与动作合成一颗会变形的按钮。** 动作按钮的位置永不移动，那是可预测性的全部来源；归档状态是另一个安静的元素。
4. **让进入画布与整理继续做双胞胎。** 一个是导航（名词），一个是命令（动词）。同尺寸、同标签、同色调并排，正是「名词与动词分离」在视觉层的反面；共用一个无填色底座只是实现复用，不是同一个材质层级。
5. **把柔光下划线用在命令上。** 那道指示只给当前态。

### 6.3 归档线

#### 可直接执行的步骤

1. **先建立纯几何与可见性策略。** 在 `archiveCordPolicy.ts` 保留 presentation/target解析，并新增目标是否在 tree viewport、钳制到 top/bottom 的方向、桌面/overlay可见性判据；把点位与 clip rect 计算下沉成纯函数并先写测试。
2. **把来源锚移进顶栏状态。** 删除 `PaperSurface` 的 `ArchivePort` 与 archive source props；归档状态元素提供 source ref/data attribute。`ArchiveTargetPort` 不再包 `ArcherElement`，只输出稳定的目标 DOM 标记并继续跟随真实 tree row。
3. **用 fixed SVG Overlay 取代 wrapper。** 将 `ArchiveCordStage` 重写/拆成 `ArchiveCordOverlay`，由 `AppDashboard` 或 Paper workspace 同级挂载，而不是包住整个路由树；`position: fixed; inset: 0`，坐标统一使用 viewport `getBoundingClientRect()`，不再做容器坐标换算。
4. **只保留一个调度器。** capture scroll、ResizeObserver、目录 MutationObserver、Panel transition 只调用 `markDirty()`；同一帧最多安排一个 rAF。rAF 内先批量读取 source/target/tree rect，再直接更新 SVG path/marker attributes，不 set React geometry state，不同时启用 CSS Anchor。
5. **实现离屏钳制。** 目标可见时端点取目标行靠纸一侧；目标在 tree 上方/下方时把 y 钳制到 tree clip rect 的安全内边距，并切换低对比上/下方向提示。目标 DOM 暂时卸载时保留 presentation，但等 MutationObserver 找回后再绘制，不能假连到任意行。
6. **复用 Cord 语法，不复制第二套线。** 归档线继续使用 archive tone、圆端点与现有 `cordGeometry` 曲线；成功 drawKey 触发一次自绘与极轻 flow，随后只降为静态 hairline。强度降档可由 CSS animation 完成，但不得用 timer 卸载线。
7. **让线可发现但不挡操作。** 可见 path 下铺一条透明宽命中线承载 hover/focus/点击保持，只有命中线开启 `pointer-events: stroke`；Overlay 其余区域必须 pointer-events none。hover source状态、目标行或命中线时共用同一高亮状态。
8. **落实生命周期。** 编辑、autosave、主纸滚动、tree滚动/展开、Panel resize只触发重算；关闭文件库隐藏 Overlay 但保留 presentation；重开恢复；切 memo、进入其他 Workspace、新 AI run、删除当前 memo清除；undo 新结果换 drawKey 与目标。
9. **Reduced Motion 与窄屏。** Reduced Motion 直接显示 settled hairline，不做 draw/flow；overlay panel模式完全不画跨层线，只保留目标行高亮。
10. **最后移除依赖。** 全仓确认无 `react-archer` import 后，从 `app/package.json` 与 lockfile 移除依赖；删除旧 Archer class/animation 与无意义的圆形 port样式，再更新技术栈文档。禁止先删依赖再边编译边找引用。

#### 文件落点

- 渲染与策略：`ArchiveCord.tsx`（或按职责拆分 Overlay/geometry）、`archiveCordPolicy.ts`、`cordGeometry.ts`、`cord.css`、`workspace.css`。
- 锚点与装配：`AppMainToolbar.tsx`/归档状态组件、`MemoTreeBranch.tsx`、`PaperSurface.tsx`、`PaperWorkspaceShell.tsx`、`AppDashboard.tsx`。
- 依赖与投影：`app/package.json`、`app/bun.lock`、`app/CLAUDE.md`、根 `CLAUDE.md`、widgets/styles L2 与所有改动文件 L3。

#### 验证

- 纯策略测试覆盖：folder优先、根memo回退、library关闭、overlay模式、目标在上/可见/在下、目标卸载与重新挂载。
- DOM/组件测试覆盖：没有Archive圆圈、状态元素是唯一source、target marker在真实tree row、Overlay不包路由内容、几何更新不经过React state。
- 浏览器验收必须做快速触控板/滚轮往返、目录展开折叠、Panel resize、长Paper滚动、关闭重开Library；逐帧观察端点无落后一帧，离屏方向提示正确。
- 用性能面板确认滚动过程中每帧最多两端rect读取和一次SVG属性写入，没有React commit风暴；不为测量修改真实用户数据。

**最容易做错的地方**

1. **用「事件触发重测量 → 状态更新 → 重渲染」实现。** 这条链的每一步都发生在浏览器已经用新滚动偏移合成过这一帧之后，线必然追在后面跑。快速滚动时的错位不是能调参数修掉的 bug，而是那种架构的必然结果。**选型错了就换选型，不要调阈值。**
2. **目标离屏时直接隐藏。** 要钳制到 Panel 边缘并转成低对比方向提示。隐藏会拿走「它在上面还是下面」这个信息，而那正是用户此刻唯一想知道的事。
3. **同时维护两套坐标真相。** 能表达钳制的那一套说话，另一套不参与。
4. **编辑正文时清掉归档状态或线。** 笔记确实还归档在那里，那是事实；擦掉一个仍然为真的事实不是刷新，是撒谎。
5. **用定时器让线自动消失。** 让它消失的必须是一个语义事件。降档只改变语气，不删除线。
6. **另造一个空端口当线的起点。** 起点是归档状态元素本身。为一个不存在的对象造身体，就是这一处原本丑的来源。

**完成锚点**：Paper 宪法第 8 节十条验收问题，逐条点头。

## 7. 本轮明确不做

划这条线是为了让上面四批可以被判定为「完成」。以下都不属于本轮，想做就单独立项：

- 不触碰 Canvas 的数据模型、WAL、mutation 内核、保存与恢复协议；本轮是形制收口，不是持久化改造。
- 不触碰 `api` 与 `chat` 任何一行。
- 不做 Canvas 宪法 13 节列的「已确认待办」：MiniMap、文件库直接拖入、自动/手工整理布局、批量 Undo。
- 不动 Compact / Paper / Menu / Panel / Dialog 的圆角档，不新增颜色、字号或动效曲线。
- 不在 Paper 上开第二套 AI 入口。
- 不把纸上的命令做成浮在纸外的固定层。

### 7.1 执行期范围守卫

- 「不做文件库直接拖入」指不在本轮新造、重写或扩展这条能力；当前已经存在的文件库→Canvas拖入路径只做回归验证，不能为了连接柄顺手改协议或持久化语义。
- 任何 diff 若落到 `api/`、`chat/`、数据库迁移、Canvas mutation/WAL/store内核，立即视为越界；先回滚该部分，再判断是否发现了新的独立任务。
- 正式 `CanvasCordEdge`、Canvas viewport、selection、drag/resize和AI expansion布局都属于保护面；本轮只允许为新UI接入做最小类型/handler改动。
- 不借「统一」清理无关CSS、不顺手换字体/颜色/阴影、不重命名大批组件。可读性重构必须与本轮行为有直接因果，且能被对应批次测试证明。

## 8. GEB 回环

每一批的代码改完，**同批**更新它的投影，不留到最后：

| 批次 | 同批必须更新 |
| --- | --- |
| 一 | `app/src/styles/CLAUDE.md`、`index.css`/`button.css`/`sidebar-button.css`/`workspace.css` 的 L3、图标注册表 L3；摘掉 `brand-spec.md` 里对应的「已批准待实施」标注，并让 Button material 一节与统一 press 一致 |
| 二 | 侧栏与 Canvas 控制条相关组件的 L3、`app/src/widgets/CLAUDE.md`、`KnowledgeCanvas/CLAUDE.md` |
| 三 | `KnowledgeCanvas/CLAUDE.md`（连接交互从 Picker 改为柄 + 两条路径）、卡片与新渲染层的 L3 |
| 四 | `workspace.css` / `note-paper.css` 的 L3、Paper 相关 widget 的 L3、`app/CLAUDE.md`（**技术栈移除 react-archer**）、根 `CLAUDE.md` 的 app 模块描述 |

三条不许违反：

- 投影文档**不得提前**改。提前改就是让文档描述一段还不存在的代码——那比过时更糟，过时是滞后，提前是撒谎。
- 决策文档在本轮实施期间**不得因为实现不便而修改**。实现不便是实现的问题。
- 本文件实施完即失效，不得被后续 Agent 当作需求来源。

### 8.1 每批命令门禁

命令从最窄到最宽执行；任一层失败就停止扩圈：

| 批次 | 最窄门禁 | 批次门禁 |
| --- | --- | --- |
| 一 | Radius/Iconography/press 静态契约与 Design System 组件测试 | `bun run typecheck`、`bun run lint` |
| 二 | `SidebarCreateMenu`、`CanvasControls`、`WorkspaceCommandPalette` 定向测试 | `bun run typecheck`、`bun run lint` |
| 三 | elastic geometry、CanvasCardNode、KnowledgeCanvas interaction、CanvasCordEdge 回归 | `bun run typecheck`、`bun run lint` |
| 四 | Paper CSS/toolbar、archive policy/geometry、workspace motion 回归 | `bun run typecheck`、`bun run lint` |

四批全部完成后，在 `app/` 运行完整 `bun test`、`bun run typecheck`、`bun run lint`、`bun run build` 与仓库根 `git diff --check`。完整门禁失败不能用「定向测试已经过」降级放行。

### 8.2 真实浏览器验收矩阵

使用专用测试账号/fixture，不修改现有用户内容；每条结论只用最窄真实流程证明：

| 维度 | 必验内容 |
| --- | --- |
| Light / Dark | 12px Control、inner同心、Primary/Tonal/Ghost层级、纸与线的对比度 |
| 1280×720 / 1440×900 | 7:9 Paper实际rect、sticky凝结、Sidebar split、Canvas controls安全区 |
| 窄屏 overlay | Paper取消比例、Panel互斥、Archive Cord只留目标高亮、Controls不与保存态重叠 |
| 鼠标 / 触控板 / 键盘 | 拖拽连接、点击连接、Esc取消、⌘K/Palette、菜单焦点归还 |
| Reduced Motion | 临时绳停止摆动、正式线/归档线静态终态、sticky无空间动画 |
| 快速滚动 | Archive端点无错位、目标离屏方向正确、Library关闭重开恢复 |

验收结束再做一次 live 页面检查，确认测试留下的Toast、Dialog、连接模式、选中态与临时fixture都已收束；测试通过不等于页面仍处于可交付状态。

### 8.3 每批交付记录

每批结束只记录四类证据，禁止混写：

1. **代码**：改了哪些职责边界，哪些保护面明确没动。
2. **测试**：定向/完整命令与通过数量。
3. **运行时**：computed token、rect、rAF/React commit等事实。
4. **真实交互**：哪条用户路径在什么viewport/theme/input下通过。

最终交付前复查 `git status`，把本轮文件与用户原有diff分开说明；没有用户明确授权不提交commit。
