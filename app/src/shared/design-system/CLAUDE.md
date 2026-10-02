# app/src/shared/design-system/
> L2 | 父级: ../CLAUDE.md

成员清单
useMotionPreference.ts: 用 useSyncExternalStore 订阅系统减少动态效果，Panel 与输入区无需刷新即可取消位移
motion.ts: 唯一通用动效源；compact-menu为新建/笔记更多共用的120/100ms时长档，几何/曲线沿用普通菜单；menu/submenu为150ms ease-out、8px/.95与-10px横移；panel保持Folune原220/170ms、左-8px/右+8px侧向淡入与原曲线，全程scale1；modal为150ms standard、.9中心缩放与父子同拍渐入。surfaceMotionCatalog直接引用生产常量供DS陈列，WorkspacePanelLayer/PresenceSurface/Dialog共用同一配方；品牌入口和纸面独立
useModalLifecycle.ts: Dialog 行为边界，统一嵌套模态栈、焦点循环/归还与计数滚动锁；Escape 在 capture 层先让内菜单处理，关闭后立即退出交互，最后一个视觉层卸载才解锁
.gitkeep: 保留 design system 层空目录
CLAUDE.md: 记录 design system 职责与文档协议
useDismissable.ts: 弹层消散原语，shellRef 与可选的 Portal contentRef 共同划定内部区域，统一外部 pointerdown、Escape 关闭与焦点归还；Escape 必定 preventDefault，使 PaperWorkspaceShell 的壳层守卫不会连带卸载外层 Panel
icons.tsx: Lucide React 图标语言边界，GaugeIcon 为用量入口、GlobeIcon 为语言菜单提供稳定语义别名；键帽 Command/Return/Space/Delete 与 Keyboard 入口统一在此适配；以稳定语义别名提供圆角描边图标；加入笔记、ZoomIn、ZoomOut、连接抓手、AI 整理与 AI 拓展各自拥有独立出口，CanvasIcon 星图区分已保存画布与笔记，IconProps 类型层只允许 14/16/20/24px 四档尺寸；Google 品牌标记作为本地图形例外
components/: 本地组件目录，承载 WarmTooltip 同组悬浮提示、平台键帽 KeyboardShortcut、通用界面组件、低对比 Skeleton/延迟显示策略、Folune AI ThinkingMark Formation Motion、ThinkingStatusText、Kumo-backed 全局 Toast 适配器、用户菜单、本层唯一持有 WebGL 表面的 ShaderGlow 流光原语与其消费方 GlowButton 强调 CTA，以及可组合过程槽/最终正文/轻量工具详情的 User/Assistant/Streaming/Thinking/ToolCall AI 消息家族；流式正文与 SSE 同速直出，历史正文保持原生文本，只允许末尾最多五个模糊动画节点且彻底不提供尾部光标，不提供通用状态胶囊

职责: APP 排版由 styles/app-typography.css 收口，正文 400、紧凑聊天/输入 500、导航/动作/标签 600，组件消费角色变量，完整规范见 ../../../brand-spec.md；场景颜色由 styles/app-visual.css 收口：无噪点纸白/黑灰底盘（浅色舞台复用 landing-paper）、同色中性 hover 与当前项，字号恢复组件原有的 12px 对话/文件树密度，输入框仅渐进加深边界，Panel/输入框/气泡使用 20px 平滑曲率，Paper 与常规控件曲率保持原样；营销继续使用下述默认基线。本地设计系统层，以 index.css 的 4px 空间基线、32px compact 导航 / 36px 标准命令与表单 / 48px 复合尺寸、柔和墨蓝主色、确定性纯白/中性灰蓝表面、8/16/12/16/20px 配套曲率与显式 12px inner Control、Button 轻微内外雾化阴影及克制动效维持整体协调；Button 文字固定为 14px/18px，Input/Select 使用 14px/20px，Editorial 正文固定为 15px/27px。普通菜单、Select 指向态与文件树 hover 必须消费同一中性 interactive-hover，APP 柔和墨蓝只服务 Primary 与明确内容强调，选中/当前位置、hover 与 focus 使用中性灰阶。Danger Button 是唯一允许使用 destructive 实心红底的组件，其他危险/错误入口只保留红色文字、图标和细边界；非 Danger loading 使用独立蓝灰 Processing 状态面，不复用 Primary 填色。Skeleton 的固定灰阶色值、形状、sRGB 组动画与出现时机在此收口，页面只组合真实布局；ToolCallBubble、Card、Input、SidebarButton 与 SegmentedControl 不得用低饱和 OKLCH 混合生成表面；AI 最终正文坚持无卡片呈现，过程与正文只以排版和自然留白形成主次，只有用户消息和工具动作拥有明确气泡；默认颜色、文字、形状和材质 token 归 index.css；APP 颜色归 styles/app-visual.css，文字角色归 styles/app-typography.css；通用 Motion 时长/曲线以 motion.ts 为唯一源，由 main 注入同源 CSS。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
