# app/src/styles/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留产品样式目录
CLAUDE.md: 记录样式层职责与文档协议
landing.css: Blueprint Landing 专用视觉层，固定使用 Light Canvas 与确定性白/中性灰蓝表面，并承载顶边贴视口、背景全宽且仅在 1200px+ hover/fine-pointer 桌面显示 1:5 外轨的粘性 Header、约为 Header 2/3 高且随页滚走的全宽公告、触屏/窄屏单轨收束、末端无节点直达 Footer 的 1088px 正文 RailLayer、14px/贴边 Divider、10px 遮罩节点、无蓝底 hover 的能力条/内容列表/定价、极简预页脚与两段式全宽深蓝 Fat Footer
workspace.css: 账户/外观、订阅、Paper First 中性画布/纯净纸张、浮动文件库/AI、安全区/覆盖抽屉/遮罩、整理目标高亮/连线/纸下回执、AI Thread/审批/Context、阅读与 Trash 布局层；>=1200px 单侧预留、>=1400px 双侧同时预留，较小视口覆盖且互斥，reduced-motion 取消空间位移与路径绘制
ai-message.css: AgentPanel 与 Design System 共用的 AI 消息视觉层，承载 Primary 同源用户气泡、无卡片最终正文、最多五词常数节点错峰模糊拖尾、Formation ThinkingIndicator，以及带人话详情、灰阶结果符号和活动态 shimmer 的 Secondary 同源工具披露控件；流式正文不提供光标，历史正文不参与动画，过程与正文之间只使用自然留白，不绘制固定分隔线
auth.css: 登录/注册 Dialog 专用样式，承载共享内凹 Input/PasswordInput 的认证尺寸、自动填充、模式切换与协议提示
design-system.css: 冻结 V1 组件质感与 ThinkingMark 固定 SVG/局部变换原点/1840ms Formation Motion；Button、Input 与 Select 统一消费 40px 默认控件高度，Button 以确定性纯白/中性灰蓝表面、统一 smooth corner、细实体边缘、零偏移均匀环绕柔影、固定原位 hover 和 1px press 收拢形成现代平面材质；Danger 保留实心红色功能面，非 Danger loading 统一切换为独立冷灰蓝状态面与 3.4s 低频窄光带 Shimmer；Skeleton 使用固定灰阶底色、单组 3.6s sRGB 宽光带与静态 reduced-motion 降级，并覆盖极轻内容 reveal、Dialog 层级及程序化聚焦规则
sidebar-button.css: SidebarButton 专用视觉层，APP/账户导航只保留与默认 Button 等高的 default/icon 尺寸和同源 smooth corner，hover 固定原位；通用选中态与 prominent 态使用低对比 Secondary 平面材质及均匀环绕柔影，侧栏底部 Design System/回收站的当前位置是无背景、无边框、无阴影、无位移的前景色例外
segmented-control.css: SegmentedControl 专用视觉层，以默认 Button 总高度、统一 smooth corner、确定性中性灰轨道与纯白选中片段组成平整控制面，不使用内凹阴影、外投影或位移
toast.css: Kumo Toast Parts 的 Apple-like SuperNote 视觉适配层，消费其堆叠/展开/滑动 data state 与 CSS 变量，以中性半透明材质、Toast 本体 smooth corner、克制阴影、轻量状态符号和圆形关闭按钮表达 info/success/warning/error；禁止旧式彩色竖线、图标盒、状态边框与彩色填充
user-menu.css: UserMenu 专用视觉层，以身份卡片、统一 smooth-corner 分组动作与确定性白/中性灰蓝底危险动作组成接近主流 AI 产品的账户弹层，并与通用 Select 样式职责分离
codemirror.css: 未分层的 CodeMirror 6 适配层，以根语义 Token 覆盖 light/dark、14px source 与 15px live 正文，并把 Live Preview Decoration 映射为严格低于文件名标题的无下划线正文标题、弱化活动标记、强调、链接、列表/任务、引用、确定性中性代码面和 GFM 表格效果；pre-wrap 继续保真原始空白
design-system-workspace.css: DEV Design System 的生产基础/组件卡片矩阵与 1440/768/390 响应式样式；首张全宽基础卡直接可视化 4px 空间标尺、32/40/48px 尺寸阶梯与真实 48/32/16 Panel Header，Button 在同一卡片不重复地展示完整 variants、loading、disabled 与真实 hover/press/focus 入口，Skeleton 展示 circle/text 真实组合，ThinkingMark 展示既定 Active Formation 的 14/16/20px 真实尺寸，AssistantMessage 预览保持透明无框

职责: UI 样式实现层；landing.css 隔离营销页，workspace.css 隔离产品布局，ai-message.css 让生产 Activity 跨 AgentPanel/Design System 同源，design-system-workspace.css 只负责同构 DEV 陈列，codemirror.css 跨越第三方级联边界；所有文件只消费 app/src/index.css 定义的语义 token，颜色插值统一使用 sRGB，禁止低饱和灰蓝经 OKLCH 插值后产生粉红表面。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
