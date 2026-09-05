# SuperNote Paper 二次形制收口 · Coding Agent 执行计划

> 决策交接文件，立于 2026-09-02。覆盖 Paper 开本、顶部工具栏、短文滚动语义与全局按钮按压质感。
> 本文件记录本轮已确认的新产品决策；它不绕过宪法。执行者必须先完成第 0 批决策文档同步，再修改代码。

## 0. 使用方式与边界

### 0.1 必读顺序

每次开始、恢复上下文或进入新批次时按顺序完整读取：

1. 本文件。
2. `PAPER_CONSTITUTION.md`、`app/brand-spec.md`、`REFINEMENT_PLAN.md`。
3. 目标目录 `CLAUDE.md` 与目标文件 L3 头部。
4. `git status --short`，把现有改动全部视为用户资产。

当前三份旧文档仍含两条被本轮重新决策的旧结论：桌面 Paper 由宽度正推高度、整理使用 Filled Primary。第 0 批必须显式替换对应条款；不得让代码先行、文档事后追认。

### 0.2 本轮只解决

- 桌面 Paper 的初始几何、Panel 对齐与短/长文滚动语义。
- Paper sticky 工具栏的归属、排列、视觉凝结和兼容降级。
- 「整理笔记」「Canvas」「阅读/编辑」「更多」的层级与稳定位置。
- Filled Primary 与语义主动作的解耦。
- 全局按钮按下时的触感统一。

### 0.3 明确不做

- 不改 `api/`、`chat/`、数据库、AI 整理流程、权限、autosave、Canvas WAL/Coordinator/mutation。
- 不改 Canvas 正式关系线、viewport、selection、拖拽、缩放与 AI expansion 布局。
- 不新造第二套 Paper AI 入口，不新增格式工具栏。
- 不引入玻璃、`backdrop-filter`、常驻阴影、渐变、发光、胶囊按钮或新的品牌色。
- 不用 wheel 事件制造弹簧，不拦截系统滚轮/触控板手势。
- 不为单一消费者新增全局 `quietAccent` Button variant；先以 Paper 专属语义样式落地，出现第二个真实消费者后再讨论上收。
- 不提交 commit，除非用户另行明确授权。

## 1. 来龙去脉与最终判断

### 1.1 现象

| 现象 | 根因 |
| --- | --- |
| 短笔记没写满也能滚、出现滚动条 | 816px 宽度上限先确定，7:9 把空纸推到约 1049px 高，再叠加舞台上下 padding |
| Paper 与左右 Panel 顶底不齐 | Panel 使用 16px viewport inset，Paper 使用独立 32px/64px 舞台 padding |
| sticky 工具栏滚动后贴浏览器顶边 | `position: sticky; top: 0` 绑定滚动视口，而非共享 Panel inset |
| Paper 上的整理按钮显得突兀 | Filled Primary 在一张安静白纸上形成永久色块，并与文件库「新建」争夺视觉主角 |
| Canvas 与整理曾像双胞胎 | 导航和命令使用相近按钮形制，名词/动词没有被视觉表达 |
| 按钮点击机械 | 全局 Button、split、EdgeDock 等使用 `translateY(1px)` 模拟下压 |

### 1.2 官方规则的交集

- [Apple Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)：减少工具栏背景与 tint，让内容保持主导；同一工具栏只突出一个主动作。
- [Apple Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)：prominent 数量按 view/context 计算，不是整个应用只有一个；过多 prominent 会增加选择成本。
- [Material Buttons](https://m3.material.io/components/buttons/guidelines)：Filled 应极少使用；Tonal/Text/Standard 提供递减层级。
- [Material Toolbars](https://m3.material.io/components/toolbars/guidelines)：工具栏只强调一个动作，层级可由颜色、尺寸与分组表达。
- [Carbon Button](https://carbondesignsystem.com/components/button/usage)：每个 screen 一个高强调 Primary，但 Header、Modal、Side Panel 是独立上下文；工具栏可用 Tertiary/Ghost 降低视觉重量。

### 1.3 本轮产品结论

1. `primary action` 是任务语义；`Primary` 是 Filled 组件材质。两者不再等同。
2. 「整理笔记」仍是 Paper 唯一核心动作，但使用 **Quiet Accent Action**，不使用 Filled Primary。
3. 文件库「新建」继续保留 Filled Primary；它属于独立 Panel 的创建锚点。
4. Paper 静止时必须保持纸感：隐藏工具栏和整理动作的“容器身体”，不隐藏文字、图标、点击区和快捷键。
5. 桌面 Paper 改为高度优先：先与 Panel 顶底对齐，再按 7:9 反算宽度；长文只向下自然增长。

## 2. 冻结后的界面规格

### 2.1 工具栏结构与顺序

```text
左侧身份区
[返回 Canvas（有真实来路时）] [归档落点（有结果时）] [滚动后标题]

右侧命令区
[整理笔记 Quiet Accent]   [Canvas Ghost]   [阅读/编辑 Ghost] [更多 Ghost]
```

规则：

- 「整理笔记」位于右侧命令区最左，是第一个被扫描到的内容动作。
- Canvas 位于整理右侧，但不占最右边；它是换空间的入口。
- 阅读/编辑与更多组成视图/文档工具组。
- 更多永远位于整个右侧命令区最右端；菜单从右边缘向纸内展开并与触发器右边缘对齐。
- 右侧命令区所有相邻命令统一使用 8px 间距：整理、Canvas、阅读/编辑、更多只有一个节奏答案。语义区分交给整理的文字＋36px hit geometry、其余命令的 32px 图标 geometry、当前态与 More 菜单行为，不再用不等间距制造分组。只用留白，不画竖线。
- 左右两区 DOM 槽位稳定；loading、标题出现、归档状态出现都不得让右侧动作换位。
- 归档状态继续位于左侧身份区并保持归档线唯一 source；不得因本轮重排移到右侧。

### 2.2 Quiet Accent Action

「整理笔记」继续使用 36px hit geometry、16px 语义图标、现有 14/18px Button 排版和 12px Control 曲率；只改变材质层级。

> 2026-09-04 follow-up: based on the accepted toolbar review, the Paper command row now uses a 32px compact geometry for organize as well. Organize is separated from the Canvas/reading/More icon cluster by 12px; the cluster itself uses 4px gaps.

| 状态 | 规格 |
| --- | --- |
| Rest | 背景、边框、外影全透明；图标＋`整理笔记`常驻；前景使用现有 Soft Ink 语义色，不增加新色 |
| Hover | 浮出极淡 `primary-soft` 表面，前景进入现有 hover 色；无描边、无位移、无外影 |
| Focus | 保留全局 focus ring；不能只靠颜色表达 |
| Active | `scale(0.98)`，soft 表面略加深，按下约 70ms；无 `translateY`、无回弹 |
| Loading | 复用现有 Processing surface、spinner 与 `aria-busy`；允许在任务进行时暂时凝结成实体，因为此时实体表达状态 |
| Success/Failure | 动作恢复 Rest；结果继续由归档状态/归档线或 Toast 表达，不让按钮变成结果状态 |
| Reduced Motion | 去掉 scale，只保留颜色/表面/焦点反馈 |

实现约束：

- 优先复用 `Button variant="ghost"` 的结构与 loading 正交状态，在 `.note-organize-button` 上消费现有 `primary`、`primary-soft`、Processing token。
- 不新增通用 Button variant，不写 raw color，不复制 spinner/shimmer。
- 文案保持「整理笔记」；内部能力仍是 AI，但界面陈述用户结果，不写「AI 整理」。
- 不根据输入焦点、键入或鼠标静止自动隐藏图标/文字。所谓“隐藏”只指隐藏容器材质。

### 2.3 其余按钮

- Canvas：32px、16px 图标、Ghost、无文字；与阅读/编辑同一视觉重量，保留 `aria-label`、tooltip、`⌘/Ctrl+E`。
- 阅读/编辑：32px Ghost 状态控制；当前态只使用既有状态语法，不把选中指示给命令。
- 更多：32px Ghost，永远最右；保持菜单焦点、Escape、外点关闭与触发器焦点归还合同。
- 文件库「新建」：继续使用 48+32px Filled Primary split，不改布局、文案与菜单项；本轮只继承新的全局 press 反馈。

### 2.4 sticky 凝结

工具栏高度继续共用 `--panel-header-height`（48px），sticky 上限改为 `--workspace-panel-inset`，不得再贴 `y=0`。

```text
scroll 0–24px    纸面 0，软边 0，标题 0
scroll 24–80px   Paper 实底锚在顶栏下沿向上长满 48px+inset，下缘软边从那条恒定边界同步长出，严格 linear（本节原写 40–96px / 软边 20px 均已废弃：区间必须早于正文抵达顶栏下沿，见 PAPER_CONSTITUTION.md §4.2 与 §4.3，现行值为 24–80px、软边 16px、模糊 6px）
scroll 36–80px   标题 opacity 0→1；只淡入，不做空间位移（原写 52–96px 已随区间一并废弃）
scroll ≥80px     完整 Paper 实底（无 hairline：这条底边线已由 PAPER_CONSTITUTION.md §4.2 于 2026-09-04 删除）
```

规则：

- 背景是完整 `paper-surface` 放在伪元素上，由注册过的几何进度改变高度；不要混合半透明背景色让正文成为纹理。
- 软边与纸面共享同一 scroll progress，从实底当前边界连续长出，不能固定挂在底部或硬切。本条原要求的 hairline 已废弃——它把「窗口上边→那条线」圈成一个会随滚动变宽的物体。
- 不加 toolbar shadow、blur、backdrop-filter 或按钮独立悬浮材质；Paper 外部柔影必须在 stage inset 内自然衰减，不能被滚动视口或 workspace 根边界硬切。
- 回滚到顶部时沿同一路径线性融回纸张。
- CSS Scroll Timeline 为首选；禁止 scroll handler 每帧 setState。
- 不支持 Scroll Timeline 的浏览器使用单个 sentinel + `IntersectionObserver` 切换 `data-condensed`，以短 opacity transition 软切；不得引入连续 JS 测量。
- Reduced Motion 取消标题位移（本方案默认已无位移）；保留与滚动直接对应的 opacity，不把它改成硬切。

### 2.5 Paper 几何与滚动

桌面初始尺寸：

```text
availableHeight = viewportHeight - 2 × workspacePanelInset
paperHeight      = availableHeight
paperWidth       = paperHeight × 7 / 9
```

旧的 816px 只是一轮宽度优先实现的结果，不再是主写作 Paper 的上限。高度优先若仍保留 816px cap，会在较高视口重新失去 Panel 底边对齐，等于同时维护两条互相冲突的几何真相。正文列宽仍独立受控，因此 Paper 变宽不会把行长一起拉长。

高度优先只在横向容得下完整 7:9 Paper 与安全边距时成立；若 `paperWidth + 2 × inlineSafeArea > viewportWidth`，进入 compact fallback，以可用宽度为先并取消精确底边对齐，绝不横向裁纸。可用性只在这个明确条件下优先于几何统一。

典型验收值（允许边框造成 ±1px）：

| Viewport | Panel/Paper 高 | Paper 宽 |
| --- | ---: | ---: |
| 1280×720 | 688px | 535px |
| 1440×900 | 868px | 675px |
| 1920×1080 | 1048px | 815px |

实现约束：

- Paper 初始顶边、底边与左右 Panel 对齐；默认 desktop inset 为 16px。
- 使用 CSS 几何所有者表达高度优先。若 `.paper-surface` 无法同时承担初始尺寸和长文增长，可新增一个无数据、无滚动职责的 sizing frame；禁止用 React/window resize state 每帧计算宽高。
- 主写作 Paper 移除 816px width cap；若 `--paper-max-width` 仍被 motion snapshot 或其他表面消费，必须缩窄/改名其职责，不能让旧 token 暗中重新钳制主 Paper。
- Paper 继续保持 7:9；正文列宽仍独立服从排版舒适区，不因为纸变窄而扩展行长。
- compact fallback 必须由 viewport/container 几何触发，不能只假设 `767px` 能覆盖所有窄而高的窗口。
- 短/空笔记：舞台 `scrollHeight <= clientHeight + 1px`，滚轮不改变 `scrollTop`，不显示 scrollbar thumb。
- 长笔记：Paper 从初始高度向下自然增长；只有 `.paper-stage-scroll` 滚动，CodeMirror scroller 继续 `overflow: visible`。
- 保留 `overscroll-behavior: contain` 的系统边界语义；不做人造抽屉/弹簧、不 transform Paper 响应 wheel。
- 窄屏继续取消固定比例，按可用视口工作；不得产生 Paper 与 stage 双重滚动。
- Reader 继续保持 1:√2 与内部滚动，Canvas card 继续 280×360；二者不在本轮变化。

### 2.6 全局按钮 press

统一目标：按钮看起来在原地“收紧”，不是向下掉一格。

- `.ds-button`、Sidebar create split、EdgeDock、Toolbar icon button 及真正复用 Button press 语义的组合控件，Active 改为 `scale(0.98)`。
- hover 永远 `transform: none`；active 以中心为原点缩放，按下约 70ms，释放使用现有 fast/standard token 回位，不新增 bounce/overshoot 曲线。
- pressed shadow 使用现有压缩态；Primary/Secondary/Quiet Accent 各消费自己的表面 token，不复制色值。
- split 必须整个外壳一起缩放，不能左右两半分别动。
- loading、disabled 不缩放；键盘 Space 按住时应得到等效 pressed 反馈，focus ring 始终可见。
- Reduced Motion 取消 scale，保留 active 色、边界和阴影压缩。
- 搜索 `translateY(1px)`、`translateY(0.0625rem)`、孤立 `scale(0.94)` 时只处理命令控件；Panel、拖拽预览、布局动效不属于本批。

## 3. 执行批次

### 第 0 批 · 同步产品真相

先改文档，后改代码：

1. `PAPER_CONSTITUTION.md`
   - 3.1：从宽度优先改为高度优先、Panel 对齐、长文自然增长。
   - 4：补充 sticky 的 Panel inset 与线性凝结规则（区间现为 24–80px，且不画 hairline，见 PAPER_CONSTITUTION.md §4.2/§4.3）。
   - 5：保留“整理是唯一核心动作”，删除“必须使用 Filled Primary”；加入 Quiet Accent 定义。
   - 8：更新开本、短文滚动、工具栏顺序与 Quiet Accent 验收问题。
2. `app/brand-spec.md`
   - Workspace controls/Paper toolbar/Paper geometry/Button material 同步本文件冻结值。
   - 明确 Library「新建」保留 Filled Primary，Paper 整理使用 Quiet Accent。
3. `REFINEMENT_PLAN.md`
   - 第一批补充全局 press 收口。
   - 6.1、6.2 替换为高度优先、最终 Toolbar 顺序和 Quiet Accent。
   - 仍保持 Paper 内部顺序：开本 → 顶栏 → 归档线。

第 0 批完成前不得碰实现。该批只更新产品决策文档，不提前修改描述“当前代码”的 CLAUDE/L3。

### 第 1 批 · 全局 press 公理

目标文件：

- `app/src/styles/button.css`
- `app/src/styles/workspace.css`
- `app/src/styles/sidebar-button.css`（仅存在独立 press 时）
- `app/src/index.css`（只有现有 token 无法表达统一 scale 时才触及）
- Design System Button specimen 与静态契约测试

步骤：消费者清单 → 最小 token/规则 → Button/组合控件测试 → Design System Light/Dark 目视 → L3/L2 回环。

### 第 2 批 · Paper 高度优先几何

目标文件：

- `app/src/styles/workspace.css`
- `app/src/widgets/PaperWorkspaceShell.tsx` / `PaperSurface.tsx`（仅 sizing frame 确实需要时）
- `app/src/styles/paperGeometry.test.ts`
- `app/src/styles/workspaceLayout.test.ts`

步骤：建立 CSS 几何所有者 → 对齐 inset → 短/长文滚动语义 → 窄屏覆盖 → 视图过渡回归 → 文档投影。

### 第 3 批 · Toolbar 结构与 Quiet Accent

目标文件：

- `app/src/widgets/AppMainToolbar.tsx`
- `app/src/widgets/MarkdownViewMenu.tsx`（只在 More 顺序/定位需要时）
- `app/src/styles/workspace.css`
- `app/src/widgets/AppMainToolbar.test.ts`
- `app/src/styles/mobileToolbar.test.ts`

步骤：先锁 DOM 顺序 → Organizer 切到 Ghost 基座＋Quiet Accent → Canvas 统一 32px Ghost → More 最右 → loading/焦点/菜单回归 → 文档投影。

### 第 4 批 · sticky 线性凝结

目标文件：

- `app/src/styles/workspace.css`
- `AppMainToolbar.tsx` 或 Paper shell（仅 fallback sentinel/observer 必需时）
- `AppMainToolbar.test.ts`

步骤：sticky inset → scroll timeline 范围 → 纸面/软边同步 linear → 标题延后淡入 → fallback → Reduced Motion → 快速滚动验收。

### 第 5 批 · 归档线与整体验收

- 不主动重构 `ArchiveCordOverlay`；只验证 Toolbar/Paper 几何变化后 source/target 仍由现有 fixed SVG + rAF 真相自动跟随。
- 若端点错位，先修 source rect/dirty trigger，不增加手工 offset 或第二套坐标系统。
- 完成全量测试、真实浏览器矩阵与 GEB 回环。

## 4. 自动化门禁

### 4.1 静态/组件测试必须锁住

- Toolbar 右侧 DOM 顺序严格为：Organizer < Canvas < View/Edit < More，且四者相邻间距统一为 8px。
- More 是最后一个可见命令，菜单不被裁剪并向纸内展开。
- Organizer 有图标＋文字、不是 `variant="primary"`、保留 loading/shortcut/aria。
- Organizer Rest 无背景/边框/外影；hover 使用现有 `primary-soft`；不出现 raw color。
- Canvas 与 View/Edit 都是 32px Ghost；二者不与 Organizer 同形。
- Button/split/EdgeDock 不再包含命令按压 `translateY`；统一 scale，Reduced Motion 有静态替代。
- 桌面 Paper 高度优先且仍为 7:9；Reader 1:√2、Canvas card 280×360 不变。
- Toolbar sticky top 使用 workspace inset，不是 0。
- scroll timeline 的凝结范围、`linear`、实底与软边同乘唯一那个进度被静态契约锁住，且契约禁止任何 hairline。

### 4.2 命令顺序

在 `app/`：

1. 相关 CSS/Toolbar/Paper 定向测试。
2. `bun run typecheck`。
3. `bun run lint`。
4. `bun test`。
5. `bun run build`。

仓库根：

6. `git diff --check`。
7. `git status --short`，区分本轮文件与用户原有改动。

任一层失败即停在当前批次修复，不跨批绕过。

## 5. 真实浏览器验收

使用专用 fixture，不修改真实用户数据。

| 维度 | 必验事实 |
| --- | --- |
| 1280×720 / 1440×900 / 1920×1080 | Paper/Panel 顶底同线；实际 rect 接近第 2.5 节表格 |
| 空、短、长笔记 | 空/短无滚动和 thumb；长文只有 stage 滚动，编辑会话不重挂载 |
| scroll 0/24/52/80px | 纸面与软边约为 0/0/0.5/1；无硬切、透字、阴影、底边线和 1px 跳动 |
| sticky | 滚动后 Toolbar y 等于 Panel inset，而不是 0 |
| Light / Dark | Quiet Accent 可见但不形成色块；Paper 仍是唯一明显深度 |
| 鼠标 / 触控板 / 键盘 | Button 原地收紧；Space/focus/快捷键等效；滚轮不触发自定义 Paper 弹性 |
| 左右 Panel 开关/resize | Panel 不挤压 Paper；Paper 几何稳定；归档线 source 无落后一帧 |
| 整理状态 | Rest 安静、Loading 明确、成功回归 Rest 并由归档状态/线表达结果 |
| 窄屏 | 取消固定比例；命令不溢出，More 仍在最右；无双重滚动 |
| Reduced Motion | 无按钮 scale、标题位移或额外弹性；状态仍清楚可用 |

## 6. 完成定义与交付格式

只有以下全部成立才算完成：

1. **产品真相**：宪法、brand spec、REFINEMENT_PLAN 已先同步。
2. **代码事实**：几何、顺序、Quiet Accent、sticky、press 全部落地，保护面未动。
3. **自动化证据**：定向、全量、typecheck、lint、build、diff check 通过。
4. **运行时证据**：rect、scrollHeight/clientHeight、sticky y、scroll progress opacity 有真实读数。
5. **交互证据**：短/长文、Panel、整理、More、键盘、Reduced Motion 在真实浏览器通过。
6. **GEB 同构**：所有改动文件 L3、目标 L2、必要 L1 与当前实现一致；本计划完成后归档或删除，不成为第四份永久宪法。

Coding Agent 最终只报告四类内容：改了什么职责边界、哪些门禁通过、哪些真实尺寸/状态被测得、还有什么未验收。不得用“代码已写”代替真实交互完成。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
