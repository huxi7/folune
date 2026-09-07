# app/src/shared/design-system/components/
> L2 | 父级: ../CLAUDE.md

成员清单
motionLifecycle.test.tsx: 真实 DOM 行为门禁，覆盖菜单快速反向开关、退出交互隔离、input 实例/光标保留、菜单/模态分层 Escape 与嵌套滚动锁；动画完成时间另由浏览器测量
Collapse.tsx: Tree/披露控件的高度生命周期原语，210ms 同源曲线、可打断、退出立即 inert；keepMounted 保留工具详情状态，减少动态效果即时改变高度
PresenceSurface.tsx: Menu/Popover/Panel 共用的无额外定位包装入退场基础件；关闭即 inert、完成后卸载，MotionSurface 支持外层 presence，定位和焦点策略留给语义组件
PersistentView.tsx: 编辑器与表单的实例保留式淡换；旧视图立即脱离布局并 inert、淡出完成 hidden，切回复用原实例和草稿，父容器提供相对定位
.gitkeep: 保留本地组件目录
CLAUDE.md: 记录本地组件目录职责与文档协议
Button.tsx: 本地 36px 标准命令组件，使用 14px/18px UI 字体、14px 横向留白与 6px 图文间距，封装 primary、弱边缘 secondary、ghost、实心红色 danger、square 与正交 loading 状态；以统一 12px smooth corner、1px 清晰内亮环、薄内侧柔光、实体边缘、零偏移雾影与极轻垂直面光形成克制的轻巧实体层级，固定原位 hover、按下原地收紧（共读 index.css 的 --press-scale，Reduced Motion 归 1）；非 Danger loading 自动切换为独立蓝灰 Processing 状态面，继续联动原生 disabled/aria-busy，并以 spinner 配合带 16 度倾角的 3.2s 低频窄 shimmer
Skeleton.tsx: 统一低对比占位加载原语，提供 rect/text/circle 形状、单组宽光带 SkeletonGroup 与 180ms 延迟出现/360ms 最短可见时长的 useDelayedSkeleton；业务只按真实内容结构组合，不自建动画或计时器
SidebarButton.tsx: 本地 32px compact 侧栏导航原子组件，以 active、default/icon 等高尺寸、default/prominent 层级和 leading/label/trailing 槽位统一 APP 与账户模态框导航；与 36px Button 共享平滑圆角和材质语言但不强制等高，hover 固定原位，选中态和 prominent 态直接复用弱边缘的 Secondary Button 材质
SegmentedControl.tsx: 紧凑互斥选择，保留 radiogroup/radio、单一 Tab 入口和方向键；只有共享选中底片做 layout 迁移，文字固定原位，减少动态效果取消底片滑动
Input.tsx: 本地 36px 默认 Input 组件，使用 14px/20px 表单文字，封装 V1 语义边框、内凹背景、placeholder、focus 与原生 ref 能力
MentionInput.tsx: 原生 contenteditable 多行输入件，以受控纯文本和不可编辑 token 同构承载 AI Composer；普通正文使用 foreground，已选 @笔记使用 primary，原生粘贴只接收纯文本
MentionInput.test.ts: MentionInput 纯文本分段回归测试，锁定中文标题、最长标题优先和特殊字符标题的内联 token 边界
PasswordInput.tsx: Input 家族的隐私输入组合件，复用 Input 内凹表面，提供受控明文/掩码切换、显隐图标按钮、aria-label/aria-pressed 与原生 input 属性/ref
Card.tsx: 静态信息表面默认不动；显式 motion=lift 才启用 4px/1.012 的 hover 层级反馈，几何由 Motion、阴影由 CSS 单独拥有，减少动态效果取消空间变化
Dialog.tsx: 全站唯一模态基础件，Portal 脱离祖先 transform、--layer-dialog 置于归档线/侧栏之上，独立 AnimatePresence 负责完整入退场；空嵌套 Dialog 不注册父退出以免悬挂，语义/焦点/滚动锁归 useModalLifecycle。默认 10px/0.985 浮现，motion=none 将纸面与遮罩完全交给原生 View Transition，遮罩永不命名
AssistantMessage.tsx: AI 消息正文根，不绘制“助手”等可见身份标题，以零卡片表面依次组合可选过程槽、独立 StreamingText 最终正文与兼容 children 工具区；向纯文本/Markdown 渲染器透传统一词级动效状态，不拥有过程分区或折叠状态
StreamingText.tsx: 首个真实 text part 后把 SSE 目标文本在同次上游更新中完整直出，不设置逐词显示队列、全文时间轴、冗余 performance 时钟或 useLayoutEffect 状态；历史正文保持原生文本，只有尾部最多 5 个词使用常数动画节点
streamingTextSegments.ts: 语言无关的流式分词纯函数，以 Intl.Segmenter 同时支持英文单词和中文语义词组，并把标点、空白及 Markdown 标记完整归入相邻显示单元
streamingTextSegments.test.ts: 流式分词、直出时间轴与时间进度回归测试，锁定英文标点/空白归组、中文语义分组、Markdown 源文本字符保真、1000 单元不排队且只动画尾部 5 个，以及 DOM 重组后通过负 animation-delay 从当前模糊进度续播
ThinkingStatusText.tsx: ThinkingIndicator 的低频中性状态文字，以 2800ms 固定宽度交叉淡化轮换“思考/整理思路/组织回答”，不虚构搜索、文件或工具行为
ThinkingIndicator.tsx: Animated Formation ThinkingMark 与 ThinkingStatusText 的无卡片行内组合件，等待正文时 active，首 token 后 160ms 淡出，活动工具出现时由调用方立即卸载
ThinkingMark.tsx: SuperNote AI 品牌符号，默认使用圆角核心、五条不对称折线连接与五个非等径外围节点表达信息聚合；固定 24×24 viewBox/currentColor/独立 data-part，并以 1840ms 非顺时针错峰 Formation Motion 提供 active 态，同时归档 Radiation/Formation/Fold 三个静态候选
UserMessageBubble.tsx: 用户消息气泡，直接复用 Primary Button 的主题色、前景色、smooth corner 与均匀环绕柔影
ToolCallBubble.tsx: 只呈现人话动作与净化详情的工具披露件；活动态复用 Secondary loading，详情用 keepMounted Collapse 连续收放并保留内部状态，无详情时不制造 tab stop
ToolCallBubble.test.tsx: 工具披露最小 DOM 契约测试，锁定执行态 shimmer、完成态结果槽、可访问详情入口、无 pre/details 调试面板及停止后未完成态静止
accessibilitySemantics.test.tsx: 基础无障碍语义回归测试，锁定 Thinking 单一播报源、隐藏 Skeleton 不宣告忙碌及 Assistant 正文不伪造具名地标
BrandMark.tsx: SuperNote 品牌标识组件，只提供 iconOnly 纯图标与“图标 + SuperNote 标题”两种稳定锁定；所有界面删除副标题形态
Toast.tsx: Kumo-backed 全局瞬时反馈边界，以 Kumo Toast Provider/Manager/Parts 接管四条可见上限、自动关闭、悬停暂停、焦点、滑动与卸载清理；ToastInput 可携带一个业务回执动作，队列仍由 Kumo 保存但 ToastItem 必须用本地 Button 渲染，避免引入第二套按钮；其余表现采用 Kumo 同源 Root/独立材质层/Content 结构与 Apple-like 中性浮层，以轻量图标传达 info/success/warning/error
Select.tsx: combobox/listbox 选择器，键盘焦点保留在 trigger、option 不增加 Tab 停靠点；上/下浮层共用 PresenceSurface 的锚点入退场，选择与关闭语义仍在本组件
UserButton.tsx: 本地用户身份原子组件，提供可复用 UserAvatar 与显示头像、姓名、邮箱、展开状态的 UserButton 触发器，不包含业务跳转
UserMenu.tsx: 账户身份与动作菜单，向上浮层共用 PresenceSurface；点击身份/设置前归还 trigger 焦点，再交给同一个 AccountDialog，退出即不再可操作
index.ts: 基础组件稳定出口，包含 PresenceSurface/MotionSurface、PersistentView、Collapse 与 CardMotion；业务界面组合生产原语，不建立第二套动画

职责: 本地组件目录；首次无旧内容的稳定结构才使用统一 Skeleton，已有内容刷新必须优先保留内容，业务组件不得复制 shimmer；AI 最终正文永远不得拥有卡片表面，用户消息复用 Primary 主题，过程与正文的语义分区由业务层决定，ToolCallBubble 只消费已净化的人话详情；所有组件只消费 app/src/index.css 的静态语义 token 与 design-system/motion.ts 的统一动效与组件层 class，不得在组件中硬编码颜色值或引入第二套 UI 系统。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
