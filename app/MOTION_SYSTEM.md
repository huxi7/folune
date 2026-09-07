# SuperNote Motion System
> 共同基线 `47dc927` · A `ec6d999` · B `3e1d344` · 实施分支 `codex/motion-system`

## A/B 评估与取舍

比较对象是本地与远端跟踪一致的两次提交。以下是源码审计结论；历史分支的视觉偏好采用用户的真实体验，不能用新实现的验收冒充旧分支浏览器实测。

| 范围 | A 实际变化、优点与问题 | B 实际变化、优点与问题 | 决策 |
| --- | --- | --- | --- |
| 全局语言 | 新增 lib/motion.js + 手写 d.ts，五档 spring、三条 easing、入退场/hover/press/反馈变体；扩大覆盖，但与 workspaceMotion、CSS token 并存，类型通过 unknown 绕过，部分变体没有消费者 | workspaceMotion 新增五档 spring，但既有 CSS 和各组件硬编码仍在 | 从基线建立类型化 DS motion.ts，生成同源 CSS；保留少量按语义命名的 preset |
| Button | motion.button 的 0.98 spring 按压有触感；原 CSS :active transform 仍存在，disabled/loading 没有独立手势门禁 | 无改动 | 保留原位 press；所有命令统一消费 CSS token，CSS 独占 transform，避免两个动画引擎争同一属性 |
| Card | 提升 4px/1.012 与阴影能表达表面层级，修复 CSS 变量阴影插值消失 | 无改动 | 保留显式 lift 的卡片反馈；普通信息容器默认静止，不让所有 Card 冒充按钮 |
| Input | focus scale 1.005 | 无改动 | 舍弃文字/输入框缩放，焦点只过渡边框与 ring |
| Modal | AnimatePresence + 0.985/10px 浮现方向好，移除竞争 CSS；但生命周期仍按 open 立即解绑，父级提前 return 的 Dialog 无法退场，未显式收口减少动态效果的时长 | 无改动 | 保留 A 的浮现幅度；统一 Portal、退出、inert、焦点归还和嵌套 Escape，Paper Preview 保留 motion=none |
| Menu/Popover/Select | 基本遗漏 | 新建菜单常驻 motion.div；其他菜单明确留待以后。文档写 AnimatePresence，实际未用；aria-hidden/pointer-events 不阻止 Tab 聚焦内部按钮，且旧 CSS 入场仍在 | 所有实际浮层接入 PresenceSurface，关闭即 inert、退出后卸载，键盘/定位保留原语义 |
| Sidebar | 沿用基线 | 220/170ms Tween 改 gentle/snappy spring；大块承载文字的 Panel 出现长尾，左右生命周期仍不同 | 舍弃 B 的 spring，统一 8px/220ms 入、8px/170ms 出，无缩放/弹跳，Stage 几何稳定 |
| Tree | 无改动 | AnimatePresence 高度 auto + spring 展开，层级关系更自然；未显式取消 reduced-motion 高度变化，退出后代仍可操作，未声明归档几何运动租约 | 保留连续高度展开，改为与 FLIP 同源的 210ms 曲线；展开只由高度负责、结构重排才 FLIP，退出即 inert，归档线按真实几何跟随 |
| 页面/辅助视图 | 根 RouteMotionBoundary 按 pathname key，忽略 query 的修复正确；/app 共用 key 避免重挂载。但动态 Outlet + wait 无法证明保留了旧路由内容，18px 横移无前进/后退语义；编辑 hidden 立即生效，读写双视图可能同时撑高 | 无新增页面机制 | 根导航复用 Router 原生 View Transition，不动画整个 Canvas；局部状态保留会话实例再淡换，退出不阻塞新内容 |
| AI 历史/会话 | wait 包裹历史/会话/加载，有感知衔接，但推迟新会话挂载且退出旧会话仍活动 | 无改动 | 淡换只拥有视觉，不用动画延长旧会话业务生命周期 |
| Trash | 无专门重排 | 条目 layout + enter/exit 方向正确；最后一项删除时父 section 由 status 切掉，exit 被一起卸载；整 article layout 会缩放正文 | 保留位置连续性，稳定 presence 宿主，layout=position，退出不可操作 |
| Landing | 首屏/reveal/stagger 统一 Motion 的意图正确；LandingSections 仍保留 useLandingReveal/data 属性，CSS blur/opacity 与 Motion 双重入场；静态图标 wiggle 没有操作语义，公告只 hover 箭头才动 | 保留基线 | 每个元素一个动画所有者；一次性、有限错峰 reveal，保留首屏/卡片质感，去掉静态图标摇摆 |
| Paper/Canvas/绳线 | 专用 View Transition 基本保留 | 明确保留几何与 receipt 系统 | 完整保留 Paper 300/240ms、正文不缩放、唯一 transition-name、WAL/Coordinator/API 边界 |

A 涉及 30 个文件，B 涉及 10 个文件。A 的 Design System 演示、订阅卡片关闭 lift、样式及文档变化属于上述对应范围；B 的测试与 audit 记录不构成真实交互验收证据。

## 统一规则

- **操作反馈**：hover 160ms 原位变色；press 90ms、0.98 原位收紧，release 160ms；disabled/loading 不按压。可操作卡片明确 opt-in lift，阴影由 CSS、几何由 Motion。
- **浮层**：Menu/Select/Popover 同源，160ms 入/130ms 出、4px 贴近触发处、0.98 起始缩放，按上/下实际位置选择原点；不逐项飞入，不让选项等待动画才可操作。
- **模态**：280ms 无过冲 spring、10px/0.985 浮现，遮罩独立 160ms 淡入；160ms 回收。所有 Dialog 持续挂载自己的 presence 边界；焦点和滚动锁不猜计时器。
- **面板**：220/170ms、8px 向对应边缘收放；宽度调整直接跟手，页面/Canvas 不跟着挤压或缩放。
- **层级**：Tree 高度 210ms，不做子项排队；折叠内容立刻 inert，真正收完才卸载。重排用同源 FLIP，归档线运动租约成对释放。
- **视图**：普通视图淡换，编辑器、表单与跨空间文件树实例稳定；跨路由由 Router 持有快照时机；query-only 登录状态不触发整页动效。
- **减少动态效果**：空间移动、缩放、spring、错峰取消；保留最多 90ms opacity，Tree 高度即时完成，内容、焦点与反馈完整。
- **专用签名**：Paper/Canvas 的浏览器纸面变形、Canvas receipt、归档线、AI 流式末尾反馈、Toast 手势与延迟 Skeleton 保持各自语义；共用基础时长不等于强行套一个动画。

## 复用方式

`shared/design-system/motion.ts` 同时输出 TypeScript 配置与 `motionTokenStyles`，根入口加载一次；CSS 只引用变量。新增浮层用 `PresenceSurface open={...}`，不能在调用方先条件卸载它。有外层 AnimatePresence 时使用 `MotionSurface`。需要保存编辑器/表单实例时用 `PersistentView`，父级提供相对定位。禁止 `transition: all`、CSS/Motion 同时写同一 transform、以固定 timer 假装退出完成。

## 验收记录

2026-09-07，内置 Chromium 浏览器完成以下验证。A/B 历史分支的评价依据源码与用户已有体验；以下逐帧结果属于本次 `codex/motion-system`。

| 验收 | 实际证据 |
| --- | --- |
| 标准 Dialog 入场 | 首帧 opacity=0、scale=0.985、y=10；约 160ms 不透明，空间运动随后收束，无反向过冲 |
| Dialog 退出/嵌套 | 实测关闭约 200ms 后 DOM 完全移除，body 滚动锁释放、焦点归还；菜单 Escape 只关菜单，嵌套 Dialog 一次只关一层 |
| 新建菜单 | 入场从 0.98/-4px 开始；退出约 143ms 卸载，首个退出帧已 inert；5 次双击反向开关后全部关闭、无残留可操作菜单 |
| Card | 实测终态 matrix(1.012,0,0,1.012,0,-4)，阴影持续为 rgba(42,40,36,.24) 0 18px 38px -24px，未出现阴影消失 |
| Tree | 高度从 0 连续到 67.5px，嵌套收起 147px→0，退出内容立即 inert；真实 AppSidebar 及归档 fixture 都完成重复开合 |
| Tree + Archive Cord | 逐帧始终只有 1 个非 inert 代表，SVG 路径持续有效；6 次反复折叠均无 NaN/错误代表，线头随树收回 |
| 左右 Panel | 右侧 8px→0、保持 scale=1；左侧退出 0→-8px，内容不卸载；真实工作台双开前后 Paper 均为 x=343.5547、y=16、w=752.8828、h=967.4141，CodeMirror 实例不变 |
| 真实设置/AI 历史 | 账户与外观切换保持 4:3 外壳；历史与对话可反复返回，退出页面无多余内容撑高；未发送消息或执行历史审批动作 |
| 真实编辑/阅读 | 阅读表面有中间 opacity 帧，CodeMirror 始终是同一个 DOM 实例，返回可继续编辑 |
| 真实辅助页面 | 进入 Design System，再回到同一篇笔记，两次均检测到原生 View Transition，编辑器与文件库实例均不变 |
| 真实 Paper/Canvas | 卡片→预览→关闭→再次预览→原文→再次 Canvas 完成重复往返；实际观察到 expand/collapse/to-editor/to-canvas 四种方向及 activeViewTransition，文件库始终为同一实例；数据准备期间保留旧页面，未用长动画掩盖请求耗时 |
| Reduced Motion | 浏览器媒体仿真下 Dialog 始终 transform=none，只做约 90ms 淡换；Tree 首个可见帧直接为最终高度，无高度补间 |
| 深色/响应式 | 在真实工作台与 fixture 检查桌面布局、窄视口样板及临时深色媒体仿真；验证后恢复浏览器媒体/尺寸覆盖，不改用户主题偏好 |
| 运行诊断 | 真实工作台最终无 error/warn；新开的 Motion 验收页反复交互后无 error/warn |

自动检查：`bun run typecheck`、`bun run lint`、`bun test`（488 pass / 0 fail，85 个测试文件）、`bun run build`、`git diff --check`。构建成功，Vite 对约 560kB 的主 chunk 给出非阻塞体积提示；本次没有用配置提高阈值来隐藏它。

验收中发现并处理的根因：

- Motion 的空嵌套 presence 若注册父退出，却没有子动画报告完成，会让透明 Dialog 悬挂并锁滚动；仅打开的嵌套 Dialog 参与退出传播。
- 关闭的视觉层不等于活跃对话框：立即撤销 role/焦点/交互，退出完成才释放最终滚动锁。
- React Flow 默认 Backspace 与产品删除确认并行，导致取消确认后选择被清空。共同基线 `47dc927` 的同一测试也复现；禁用默认 deleteKeyCode，让既有 requestNodeRemoval 独占删除后，20 项 Canvas DOM→WAL 交互测试全部通过。
- 原 Paper 内容容器按辅助视图 key 重挂载，会重建隐藏编辑器；现在保持容器身份，单篇笔记会话仍由 memoClientKey 决定。
- 右键菜单通过 Portal 锚定真实视口，避免侧栏 transform 改变 fixed 坐标；Dialog 的统一层级高于归档线与侧栏。

演示入口：[Motion Lab](http://localhost:10000/motion-lab)，以及真实工作台里的 Design System → Motion。所有模拟创建/退出按钮只更新 fixture 状态；真实业务验收没有修改笔记正文，也没有执行删除或 AI 消息。

边界：本次覆盖当前本机内置 Chromium、现有测试与关键真实往返；未宣称完成所有浏览器/所有数据规模的性能认证。Safari/Firefox 的手工回归可作为后续发布门禁。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## AI Panel 可感知性修正 · 2026-09-07

原实现虽然使用 DS token，但 160ms 纯透明度不足以表达历史/会话的空间关系；退出层的 `bottom:auto` 还使聊天区从实测 825px 重新撑到约 1757px。固定高度 Panel 现在显式启用 `PersistentView fill`，退出仍覆盖同一内容窗口。

- 历史作为会话目录，从左侧 24px 进入、向左退出；进入 280ms、退出 180ms。历史占满内容区，对话原位淡换，不推挤、不缩放、不留遮罩窄条。普通文档视图继续默认淡换。
- 顶栏固定且只有一条：历史接管标题与左侧返回按钮，新建和面板收起保持原位；不在列表内再放历史标题或关闭按钮。
- 新会话的 Composer 在身份建立时独立从下方 12px 浮现，延后 32ms、持续 280ms；打字和普通 rerender 不重播，历史返回保留同一会话实例。
- 创建期间保留旧内容并给新建按钮 loading；成功后显式离开历史页，失败保留旧视图并显示错误回执。
- Reduced Motion 取消两类位移/错峰，只保留 90ms 淡换。
- Design System/Motion Lab 加入同源 Panel 样板，可反复体验历史切换与新会话，不发送消息或访问业务 API。

### 本轮验收

- 内置浏览器真实工作台逐帧：历史 x 从 -24px 收敛到 0；顶栏固定 48px、两个内容层切换期间保持 833px，仅一条顶栏，无列表内重复标题。
- 查看历史再返回：临时草稿保持，消息 scrollTop 前后均为 891.5；清除测试草稿后，新建空会话成功返回聊天，Composer 捕获 y=12px/opacity=0 至原位可见的连续帧。本轮创建了两条空会话，未发送消息。
- 快速反向开合正常；减少动态效果在页面载入及运行中切换都只淡换，无空间位移。Panel 与 Composer 通过 DS useMotionPreference 实时订阅偏好。
- typecheck、lint、build 通过；最终全量 488/488 测试通过。中间一次 Canvas pagehide 测试失败，独立复跑 8/8 与最终全量均通过，未修改 Canvas 保存逻辑。构建仍有既有的大于 500kB chunk 提示。

### 两侧面板稳定性修正

普通笔记→笔记导航不启动整页 View Transition，避免 root 快照连同常驻文件树一起淡换；PaperSurface 仅按正文身份重播局部过渡，不通过 key 卸载内容。Canvas 空间转换继续沿用原有纸面过渡。

AI 消息首次挂载在 layout effect 中直接定位到底部；退出时以 instant 取消尚未结束的原生 smooth scroll 并保持即时位置，presence 退出及历史隐藏期间忽略内容增长的追尾回调。重新挂载仍从底部开始，但不展示从顶部滚到底部的过程。

代码验收：493 项测试通过，包含首次直接定位、退出冻结及迟到回调隔离；typecheck、lint、build 通过。按用户要求未使用浏览器，本轮视觉效果待用户手动验收。

后续定位：keepMounted Collapse 原先没有自己的 AnimatePresence，直接继承父面板退出，把已展开详情高度收成零，引发正文重排。现在常驻与非常驻详情均有独立、不传播父退出的 presence 边界；面板离场不改变内部展开状态。退出取消平滑滚动时读取即时 scrollTop，不回退到可能滞后的 scroll 事件缓存。新增父面板退出隔离回归测试。

退出隔离测试已做反证：还原旧 Collapse 实现时失败，恢复修复后通过；本轮仍未使用浏览器，视觉结果由用户手动验收。
