# app/src/shared/design-system/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 design system 层空目录
CLAUDE.md: 记录 design system 职责与文档协议
components/: 本地组件目录，承载通用界面组件、低对比 Skeleton/延迟显示策略、SuperNote AI ThinkingMark Formation Motion、ThinkingStatusText、全局 Toast、用户菜单，以及 User/Assistant/Streaming/Thinking/ToolCall 互斥 AI 消息家族；不提供 cursor 或通用状态胶囊

职责: 本地设计系统层，以自然现代主色、确定性纯白/中性灰蓝表面、统一 smooth corner、Button 零偏移环绕柔影与克制动效维持整体协调；Danger Button 是唯一允许使用 destructive 实心红底的组件，其他危险/错误入口只保留红色文字、图标和细边界；非 Danger loading 使用独立状态面，不复用 Primary 填色。Skeleton 的固定灰阶色值、形状、sRGB 组动画与出现时机在此收口，页面只组合真实布局；ToolCallBubble、Card、Input、SidebarButton 与 SegmentedControl 不得用低饱和 OKLCH 混合生成表面；AI 正文坚持无卡片呈现，Thinking、活动工具与 StreamingText 互斥，只有用户消息和工具活动拥有明确气泡；所有视觉 token 必须以 app/src/index.css 为唯一真相源。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
