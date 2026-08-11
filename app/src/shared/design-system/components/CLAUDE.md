# app/src/shared/design-system/components/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留本地组件目录
CLAUDE.md: 记录本地组件目录职责与文档协议
Button.tsx: 本地 40px 默认命令组件，封装 primary、弱边缘 secondary、ghost、实心红色 danger、square 与正交 loading 状态；以统一 smooth corner、干净纯色平面、细实体边缘、零偏移环绕柔影、固定原位 hover 和 1px press 收拢形成现代克制层级，不使用静态渐变、顶部内高光或底部偏色暗线；非 Danger loading 自动切换为独立冷灰蓝状态面，继续联动原生 disabled/aria-busy，并以 spinner 配合 3.4s 低频窄 shimmer
Skeleton.tsx: 统一低对比占位加载原语，提供 rect/text/circle 形状、单组宽光带 SkeletonGroup 与 180ms 延迟出现/360ms 最短可见时长的 useDelayedSkeleton；业务只按真实内容结构组合，不自建动画或计时器
SidebarButton.tsx: 本地侧栏导航原子组件，以 active、default/icon 等高尺寸、default/prominent 层级和 leading/label/trailing 槽位统一 APP 与账户模态框导航；默认高度和平滑圆角与 Button 一致，hover 固定原位，选中态和 prominent 态直接复用弱边缘的 Secondary Button 材质
SegmentedControl.tsx: 本地紧凑互斥选择原子组件，以受控值、原生 button、radiogroup/radio、单一 Tab 停靠点与方向键/Home/End 切换统一少量稳定选项；视觉只消费平整语义表面，不复刻 Button 的立体位移
Input.tsx: 本地 40px 默认 Input 组件，封装 V1 语义边框、内凹背景、placeholder、focus 与原生 ref 能力
PasswordInput.tsx: Input 家族的隐私输入组合件，复用 Input 内凹表面，提供受控明文/掩码切换、显隐图标按钮、aria-label/aria-pressed 与原生 input 属性/ref
Card.tsx: 本地 Card 组件，仅保留产品实际使用的 default、accent 两种 V1 语义表面与短阴影
Dialog.tsx: 本地 Dialog 组件，封装 default/compact 密度、default/account 宽度、default/embedded 标题模式、受控弹窗、中性遮罩、标题描述关联、Esc 关闭、完整表单焦点循环、滚动锁定与关闭后焦点恢复；embedded 模式允许 AccountDialog 在同一弹窗语义内拥有横竖分隔标题骨架
AssistantMessage.tsx: AI 消息正文根，不绘制“助手”等可见身份标题，以零卡片表面依次组合可选过程槽、独立 StreamingText 最终正文与兼容 children 工具区；不拥有过程分区或折叠状态
StreamingText.tsx: 首个真实 text part 后逐字符追赶 SSE 目标文本，每出现一个字符重启轻微双向光晕；无圆点 cursor，SDK 离开 streaming 后立即补齐正文
ThinkingStatusText.tsx: ThinkingIndicator 的低频中性状态文字，以 2800ms 固定宽度交叉淡化轮换“思考/整理思路/组织回答”，不虚构搜索、文件或工具行为
ThinkingIndicator.tsx: Animated Formation ThinkingMark 与 ThinkingStatusText 的无卡片行内组合件，等待正文时 active，首 token 后 160ms 淡出，活动工具出现时由调用方立即卸载
ThinkingMark.tsx: SuperNote AI 品牌符号，默认使用圆角核心、五条不对称折线连接与五个非等径外围节点表达信息聚合；固定 24×24 viewBox/currentColor/独立 data-part，并以 1840ms 非顺时针错峰 Formation Motion 提供 active 态，同时归档 Radiation/Formation/Fold 三个静态候选
UserMessageBubble.tsx: 用户消息气泡，直接复用 Primary Button 的主题色、前景色、smooth corner 与均匀环绕柔影
ToolCallBubble.tsx: 工具调用专用披露控件，整颗主按钮可点击但不绘制多余展开箭头，只展示人话动作、相关图标与灰阶结果符号，复用 Secondary Button 材质且活动态只增加低频 shimmer；点击后以普通定义列表展示调用方提供的目标/位置/结果，不接收或渲染原始载荷
ToolCallBubble.test.tsx: 工具披露最小 DOM 契约测试，锁定执行态 shimmer、完成态结果槽、可访问详情入口、无 pre/details 调试面板及停止后未完成态静止
BrandMark.tsx: SuperNote 品牌标识组件，只提供 iconOnly 纯图标与“图标 + SuperNote 标题”两种稳定锁定；所有界面删除副标题形态
Toast.tsx: Kumo-backed 全局瞬时反馈边界，以 Kumo Toast Provider/Manager/Parts 接管四条可见上限、自动关闭、悬停暂停、焦点、滑动与卸载清理；表现层采用 Kumo 同源 Root/独立材质层/Content 结构与 Apple-like 中性浮层，只以轻量图标传达 info/success/warning/error，业务层不感知第三方实现
Select.tsx: 本地 Select 原子组件，提供受控/非受控值、上下布局、点击外部关闭、Esc/Tab/方向键/Home/End/Enter 键盘交互与自定义触发器能力；当前产品界面不消费，因此不进入开发态生产组件陈列
UserButton.tsx: 本地用户身份原子组件，提供可复用 UserAvatar 与显示头像、姓名、邮箱、展开状态的 UserButton 触发器，不包含业务跳转
UserMenu.tsx: 本地账户菜单组合组件，顶部身份卡片整栏可点击并直达个人资料，下方不重复个人资料项，只发出订阅、设置与退出命令；支持外部点击/Esc/方向键焦点管理
index.ts: 本地 design system 组件出口，统一暴露通用组件、Skeleton/延迟显示策略、ThinkingMark/ThinkingStatusText/互斥 AI 消息家族、Toast 根能力与公开类型

职责: 本地组件目录；首次无旧内容的稳定结构才使用统一 Skeleton，已有内容刷新必须优先保留内容，业务组件不得复制 shimmer；AI 最终正文永远不得拥有卡片表面，用户消息复用 Primary 主题，过程与正文的语义分区由业务层决定，ToolCallBubble 只消费已净化的人话详情；所有组件只能使用 app/src/index.css 暴露的语义 token 与组件层 class，不得在组件中硬编码颜色值或引入第二套 UI 系统。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
