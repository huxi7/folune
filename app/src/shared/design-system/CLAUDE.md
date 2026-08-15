# app/src/shared/design-system/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 design system 层空目录
CLAUDE.md: 记录 design system 职责与文档协议
components/: 本地组件目录，承载通用界面组件、低对比 Skeleton/延迟显示策略、SuperNote AI ThinkingMark Formation Motion、ThinkingStatusText、Kumo-backed 全局 Toast 适配器、用户菜单，以及可组合过程槽/最终正文/轻量工具详情的 User/Assistant/Streaming/Thinking/ToolCall AI 消息家族；流式正文与 SSE 同速直出，历史正文保持原生文本，只允许末尾最多五个模糊动画节点且彻底不提供尾部光标，不提供通用状态胶囊

职责: 本地设计系统层，以 index.css 的 4px 空间基线、32px compact 导航 / 36px 标准命令与表单 / 48px 复合尺寸、柔和墨蓝主色、确定性纯白/中性灰蓝表面、8/10/12/16/20px 配套曲率、Button 轻微内外雾化阴影与克制动效维持整体协调；Button 文字固定为 14px/18px，Input/Select 使用 14px/20px，Editorial 正文固定为 15px/27px。普通菜单、Select 指向态与文件树 hover 必须消费同一中性 interactive-hover，柔和墨蓝只服务 Primary、选中/当前位置、focus 与明确整理反馈。Danger Button 是唯一允许使用 destructive 实心红底的组件，其他危险/错误入口只保留红色文字、图标和细边界；非 Danger loading 使用独立蓝灰 Processing 状态面，不复用 Primary 填色。Skeleton 的固定灰阶色值、形状、sRGB 组动画与出现时机在此收口，页面只组合真实布局；ToolCallBubble、Card、Input、SidebarButton 与 SegmentedControl 不得用低饱和 OKLCH 混合生成表面；AI 最终正文坚持无卡片呈现，过程与正文只以排版和自然留白形成主次，只有用户消息和工具动作拥有明确气泡；所有视觉 token 必须以 app/src/index.css 为唯一真相源。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
