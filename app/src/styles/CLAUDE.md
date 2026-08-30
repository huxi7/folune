# app/src/styles/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留产品样式目录
CLAUDE.md: 记录样式层职责与文档协议
global-base.css: 全局浏览器基础层，消费 index.css 语义 token，收口文档根、表单字体、选择色、滚动条、指针与 reduced-motion 兜底
landing.css: Blueprint Landing 专用视觉层，固定使用 Light Canvas 与确定性白/中性灰蓝表面，并承载顶边贴视口、背景全宽且仅在 1200px+ hover/fine-pointer 桌面显示 1:5 外轨的粘性 Header、约为 Header 2/3 高且随页滚走的全宽公告、触屏/窄屏单轨收束、末端无节点直达 Footer 的 1088px 正文 RailLayer、14px/贴边 Divider、10px 遮罩节点、无蓝底 hover 的能力条/内容列表/定价、极简预页脚与两段式全宽深蓝 Fat Footer
note-paper.css: 共享纸面视觉层，唯一实现 .note-paper 与 thumbnail/reader 两个 variant 的纸边、曲率、Editorial 标题与摘录收尾；thumbnail 让正文写到纸底后以五段文字透明度连续衰减，并叠加完全无填色的渐进背景失焦，禁止不透明覆盖层形成横向色带，reader 按 ISO 216 的 1:√2 立成 A4 开本（宽取 40rem/视口高/视口宽三者最紧者，高由比例导出），消费 --paper-float-shadow 的渐变柔影，纸面静止而正文在纸内滚动、页边固定为纸宽 8%；Canvas 卡片与预览共用，禁止任何组件复制近似 Paper 样式
workspace.css: 账户/外观、订阅、Paper First Stage/816px Paper、Paper/Canvas 共用独立浮动 Panel、树/命令/AI/Trash 布局与惰性 AI 占位；Panel 开合不创建侧边轨道或改变 Stage/Paper/Canvas 几何，较小视口覆盖互斥，reduced-motion 取消空间位移
workspaceLayout.test.ts: 工作区浮层 Sidebar 的 CSS 契约测试，锁定 Panel 开合状态不再写入父级网格轨道，Paper/Canvas 始终占据唯一全屏 Stage
ai-message.css: AgentPanel 与 Design System 共用的 AI 消息视觉层，承载 Primary 同源用户气泡、无卡片最终正文、最多五词常数节点错峰模糊拖尾、Formation ThinkingIndicator，以及带人话详情、灰阶结果符号和活动态 shimmer 的 Secondary 同源工具披露控件；流式正文不提供光标，历史正文不参与动画，过程与正文之间只使用自然留白，不绘制固定分隔线
auth.css: 登录/注册 Dialog 专用样式，承载共享平面 Input/PasswordInput 的认证尺寸、自动填充、模式切换与协议提示
design-system.css: Quiet Editorial 基础组件视觉层与 ThinkingMark Formation Motion；Dialog 同时提供压暗遮罩的 panel 表面与只承担模态几何、遮罩改为明亮磨砂以便 children 自带柔影可见的 bare 表面，Input/Select 使用 36px 表单高度与 10px 控件曲率，Select 临时指向态与普通菜单共享中性 interactive-hover，消费纯色表面和 Hairline；Button 由 button.css 独立维护，Skeleton/Loading 只保留低频信息型光带并在 reduced-motion 静止
button.css: Button 专用视觉层；统一 36px 标准命令高度、14px/18px UI 文字、14px 横向留白、6px 图文间距、10px 控件曲率，以 1px 清晰内亮环和薄内侧柔光构成克制的连续环绕内高光；Primary/Secondary/Danger/Ghost 共用 1px press 与 16 度倾斜窄光带 Saving 状态，文件树、SidebarButton 与 Header 命令独立消费 32px compact 尺寸
sidebar-button.css: SidebarButton 专用 32px compact 平面视觉层，APP/账户导航与 36px 标准 Button 共享 10px 控件曲率而不强制等高；hover 消费全局中性 interactive-hover，active 只使用轻中性表面和墨色，hover/press/选中不抬升，侧栏底部 Design System/回收站以 12px/16px Label 文字和 primary 前景色表达当前位置
segmented-control.css: SegmentedControl 专用视觉层，以默认 Button 总高度、统一 smooth corner、确定性中性灰轨道与纯白选中片段组成平整控制面，不使用内凹阴影、外投影或位移
toast.css: Kumo Toast Parts 的 Quiet Editorial 适配层，消费其堆叠/展开/滑动 data state，以中性不透明 Popover、12px 曲率、克制浮层阴影、轻量状态符号与本地 Button 单一回执动作表达 info/success/warning/error；禁止玻璃、彩色容器、竖线、图标盒与 Kumo Button
user-menu.css: UserMenu 专用视觉层，以身份卡片、统一 smooth-corner 分组动作、与文件树同源的中性 interactive-hover 及无填色危险动作组成账户弹层，并与通用 Select 样式职责分离
codemirror.css: 未分层的 CodeMirror 6 适配层，以根语义 Token 覆盖 light/dark、14px source 与 15px live 正文，并把 Live Preview 标题/引用映射到 Editorial 字体、活动标记弱化、链接/列表/任务/代码/GFM 表格保持清晰；第三方语法颜色不得泄漏为竞争性色轴，pre-wrap 继续保真原始空白
cord.css: Cord Signature 表现层，按语境把 --cord-color 映射到既有 --archive-cord/--primary，承载 pathLength 归一化的出场自绘、虚实区分与自中点向两端流动的双层白光；外发光用更宽更淡的第二条描边而非 feGaussianBlur，reduced-motion 直接静态
knowledge-canvas.css: Canvas 表现层；统一顶层坐标、React Flow/点阵、真实比例延迟 Skeleton、memo 拖入边界与提示、卡片/空间文字/动态关系，并为 Card→Preview 设置 240ms 原生空间过渡且关闭 root 交叉淡化；reduced-motion 直接呈现静态结果
design-system-workspace.css: DEV Design System 五层生产矩阵与响应式样式；直接可视化 Foundations、Lucide Iconography、真实主题切换、组件全状态检查轨、CodeMirror/Reading/Quote/Code 及 Paper Surface/Edge Dock/Archive Cord，所有演示只消费生产 Token
color-lab.css: DEV `/color-lab` 蓝色终选决策画布，以同构静态 Library/Paper/AI 工作区、候选选择与 Light/Dark 响应式控制消费 index.css 隔离的现有蓝/灰蓝/标准墨蓝/柔和墨蓝 token；不定义颜色值、不读取业务状态、不改生产主题

职责: UI 样式实现层；landing.css 隔离营销页，workspace.css 承载 Paper/Canvas 共用产品壳，note-paper.css 收口共享纸面，knowledge-canvas.css 隔离图交互，ai-message.css 让生产 Activity 跨 AgentPanel/Design System 同源，design-system-workspace.css 与 color-lab.css 分别负责组件陈列和隔离配色决策，codemirror.css 跨越第三方级联边界；所有文件只消费 app/src/index.css 语义 token，颜色插值统一使用 sRGB。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
