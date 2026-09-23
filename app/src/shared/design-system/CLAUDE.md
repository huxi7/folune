# app/src/shared/design-system/
> L2 | 父级: ../CLAUDE.md

成员清单
useMotionPreference.ts: 用 useSyncExternalStore 订阅系统减少动态效果，Panel 与输入区无需刷新即可取消位移
motion.ts: 增加目录视图的左侧 24px/280ms 进入及新上下文输入表面的 12px/280ms 浮现；Design System 唯一通用动效源，按操作/浮层/模态/面板/层级输出时长、曲线、有限 spring 和同源 CSS 声明，32ms 错峰步长与 128ms 上限同步导出给营销 CSS；领域纸面/绳线几何不进入通用层
useModalLifecycle.ts: Dialog 行为边界，统一嵌套模态栈、焦点循环/归还与计数滚动锁；Escape 在 capture 层先让内菜单处理，关闭后立即退出交互，最后一个视觉层卸载才解锁
.gitkeep: 保留 design system 层空目录
CLAUDE.md: 记录 design system 职责与文档协议
useDismissable.ts: 弹层消散原语，统一「外部 pointerdown 关闭 + Escape 关闭 + 焦点归还触发器」三件事；Escape 分支必定 preventDefault，这是与 PaperWorkspaceShell 壳层守卫之间的层级仲裁协议——内层消费过的 Escape 不得再关闭外层 Panel，否则一次误触会连带卸载 Panel 并销毁其中的本地草稿
icons.tsx: Lucide React 图标语言边界，以稳定语义别名提供圆角描边图标；加入笔记、ZoomIn、ZoomOut、连接抓手、AI 整理与 AI 拓展各自拥有独立出口，CanvasIcon 星图区分已保存画布与笔记，IconProps 类型层只允许 14/16/20/24px 四档尺寸；Google 品牌标记作为本地图形例外
components/: 本地组件目录，承载通用界面组件、低对比 Skeleton/延迟显示策略、Folune AI ThinkingMark Formation Motion、ThinkingStatusText、Kumo-backed 全局 Toast 适配器、用户菜单，以及可组合过程槽/最终正文/轻量工具详情的 User/Assistant/Streaming/Thinking/ToolCall AI 消息家族；流式正文与 SSE 同速直出，历史正文保持原生文本，只允许末尾最多五个模糊动画节点且彻底不提供尾部光标，不提供通用状态胶囊

职责: 本地设计系统层，以 index.css 的 4px 空间基线、32px compact 导航 / 36px 标准命令与表单 / 48px 复合尺寸、柔和墨蓝主色、确定性纯白/中性灰蓝表面、8/12/12/16/20px 配套曲率与显式 9px inner Control、Button 轻微内外雾化阴影及克制动效维持整体协调；Button 文字固定为 14px/18px，Input/Select 使用 14px/20px，Editorial 正文固定为 15px/27px。普通菜单、Select 指向态与文件树 hover 必须消费同一中性 interactive-hover，柔和墨蓝只服务 Primary、选中/当前位置、focus 与明确整理反馈。Danger Button 是唯一允许使用 destructive 实心红底的组件，其他危险/错误入口只保留红色文字、图标和细边界；非 Danger loading 使用独立蓝灰 Processing 状态面，不复用 Primary 填色。Skeleton 的固定灰阶色值、形状、sRGB 组动画与出现时机在此收口，页面只组合真实布局；ToolCallBubble、Card、Input、SidebarButton 与 SegmentedControl 不得用低饱和 OKLCH 混合生成表面；AI 最终正文坚持无卡片呈现，过程与正文只以排版和自然留白形成主次，只有用户消息和工具动作拥有明确气泡；颜色、文字、形状和材质 token 以 app/src/index.css 为真相源；通用 Motion 时长/曲线以 motion.ts 为唯一源，由 main 注入同源 CSS。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
