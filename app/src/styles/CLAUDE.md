# app/src/styles/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留产品样式目录
CLAUDE.md: 记录样式层职责与文档协议
landing.css: Blueprint Landing 专用视觉层，固定使用 Light Canvas 与确定性白/中性灰蓝表面，并承载顶边贴视口、背景全宽且仅在 1200px+ hover/fine-pointer 桌面显示 1:5 外轨的粘性 Header、约为 Header 2/3 高且随页滚走的全宽公告、触屏/窄屏单轨收束、末端无节点直达 Footer 的 1088px 正文 RailLayer、14px/贴边 Divider、10px 遮罩节点、无蓝底 hover 的能力条/内容列表/定价、极简预页脚与两段式全宽深蓝 Fat Footer
workspace.css: 账户/外观、订阅、Paper First 暖中性 Canvas/816px Paper、Edge Dock、浮动文件库/AI、安全区/覆盖抽屉/遮罩、Archive Port/Target/Cord/纸下回执、AI Thread/审批/Context、Editorial 阅读与 Trash 布局层；>=1200px 单侧预留、>=1400px 双侧同时预留，较小视口覆盖且互斥，reduced-motion 取消空间位移与路径绘制
ai-message.css: AgentPanel 与 Design System 共用的 AI 消息视觉层，承载 Primary 同源用户气泡、无卡片最终正文、最多五词常数节点错峰模糊拖尾、Formation ThinkingIndicator，以及带人话详情、灰阶结果符号和活动态 shimmer 的 Secondary 同源工具披露控件；流式正文不提供光标，历史正文不参与动画，过程与正文之间只使用自然留白，不绘制固定分隔线
auth.css: 登录/注册 Dialog 专用样式，承载共享平面 Input/PasswordInput 的认证尺寸、自动填充、模式切换与协议提示
design-system.css: Quiet Editorial 基础组件视觉层与 ThinkingMark Formation Motion；Button/Input/Select 统一消费 40px 默认控件高度、8px 曲率、纯色表面和 Hairline，默认无实体阴影/内高光，hover 固定原位且 press 只下压 1px；Danger 是唯一实心红色功能面，Skeleton/Loading 只保留低频信息型光带并在 reduced-motion 静止
sidebar-button.css: SidebarButton 专用平面视觉层，APP/账户导航与默认 Button 等高并消费同一 8px 控件曲率；active 只使用轻中性表面和墨色，hover/press/选中不抬升，侧栏底部 Design System/回收站以 primary 前景色表达当前位置
segmented-control.css: SegmentedControl 专用视觉层，以默认 Button 总高度、统一 smooth corner、确定性中性灰轨道与纯白选中片段组成平整控制面，不使用内凹阴影、外投影或位移
toast.css: Kumo Toast Parts 的 Quiet Editorial 适配层，消费其堆叠/展开/滑动 data state，以中性不透明 Popover、12px 曲率、克制浮层阴影与轻量状态符号表达 info/success/warning/error；禁止玻璃、彩色容器、竖线和图标盒
user-menu.css: UserMenu 专用视觉层，以身份卡片、统一 smooth-corner 分组动作与确定性白/中性灰蓝底危险动作组成接近主流 AI 产品的账户弹层，并与通用 Select 样式职责分离
codemirror.css: 未分层的 CodeMirror 6 适配层，以根语义 Token 覆盖 light/dark、14px source 与 15px live 正文，并把 Live Preview 标题/引用映射到 Editorial 字体、活动标记弱化、链接/列表/任务/代码/GFM 表格保持清晰；第三方语法颜色不得泄漏为竞争性色轴，pre-wrap 继续保真原始空白
design-system-workspace.css: DEV Design System 五层生产矩阵与响应式样式；直接可视化 Foundations、真实主题切换、组件全状态检查轨、CodeMirror/Reading/Quote/Code 及 Paper Surface/Edge Dock/Archive Cord，所有演示只消费生产 Token

职责: UI 样式实现层；landing.css 隔离营销页，workspace.css 隔离产品布局，ai-message.css 让生产 Activity 跨 AgentPanel/Design System 同源，design-system-workspace.css 只负责同构 DEV 陈列，codemirror.css 跨越第三方级联边界；所有文件只消费 app/src/index.css 定义的语义 token，颜色插值统一使用 sRGB，禁止低饱和灰蓝经 OKLCH 插值后产生粉红表面。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
