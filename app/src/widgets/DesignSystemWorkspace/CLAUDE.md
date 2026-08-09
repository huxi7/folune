# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 Design System 工作区目录
CLAUDE.md: 记录开发态 Design System 工作区职责与文档协议
index.tsx: DesignSystemWorkspace 入口，以紧凑页头和单一同构卡片矩阵陈列全部生产组件，不为个别组件建立独立大版面
componentCatalog.ts: 组件目录，登记含 Skeleton 在内的十个通用组件家族、既定 ThinkingMark 及 UserMessageBubble、AssistantMessage、ThinkingIndicator、ToolCallBubble 四个 AI 消息家族
ComponentTile.tsx: memo 化组件卡片，组合单一组件名、单句职责摘要与带组件身份的真实预览面板，使陈列层可以显式保留 AssistantMessage 的无框边界
ComponentPreview.tsx: memo 化真实 API 预览器，在纯白画布的 Button 同一卡片直接展示 primary/secondary/ghost/实心红色 danger、独立冷灰蓝 Saving loading、square、disabled 与可交互 hover/press/focus，在 Skeleton 卡片展示固定中性灰底与一条组级 sRGB 宽光带下的 circle/text 组合，并让 ToolCallBubble、Card、Input、SidebarButton 与 SegmentedControl 直接显露纯白/中性灰真实表面，此外提供既定 Active Formation ThinkingMark 的 14/16/20px 真实尺寸、可重播 AI 逐字/光晕完成态、用户气泡、正式 ThinkingIndicator 与工具调用样例

职责: 开发态 V1 Design System 参考工作区，只在 import.meta.env.DEV 下通过 /app Sidebar 暴露；工作区与组件卡片使用纯净画布，Danger Button 是唯一允许保留实心红色功能面的组件，其余危险/错误语义不允许红色填充；Button 卡片必须直接看见独立 Saving 状态与 Shimmer。所有生产组件共用同一卡片、标题、摘要与预览结构，AI 预览直接复用生产组件，AssistantMessage 自身严禁卡片表面。所有视觉值继续由 index.css 的 V1 语义 token 集中管理。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
