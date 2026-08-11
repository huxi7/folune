# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 Design System 工作区目录
CLAUDE.md: 记录开发态 Design System 工作区职责与文档协议
index.tsx: DesignSystemWorkspace 入口，以紧凑页头先呈现生产空间基础，再用同构卡片矩阵陈列全部生产组件，不制造展示专用尺寸
componentCatalog.ts: 基础与组件目录，先登记 SpatialRhythm 空间规范，再登记通用组件、既定 ThinkingMark 及 UserMessageBubble、AssistantMessage、ThinkingIndicator、ToolCallBubble 四个 AI 消息家族
ComponentTile.tsx: memo 化同构卡片，组合基础/组件名称、单句职责摘要与带身份的真实预览面板，使 SpatialRhythm 可全宽呈现且 AssistantMessage 保持无框边界
ComponentPreview.tsx: memo 化生产 token/API 预览器；SpatialRhythm 直接读取 4px 空间阶梯，展示 32/40/48px 控件层级与 48px Header/32px 控件/16px 图标样板；Button 同一卡片不重复展示 primary/secondary/ghost/实心红色 danger、独立冷灰蓝 Saving loading、disabled 与 hover/press/focus，Skeleton 展示单组 sRGB 宽光带下的 circle/text 组合，ToolCallBubble 展示执行中/完成态，另提供 Card、Input、SidebarButton、SegmentedControl、14/16/20px ThinkingMark、可重播 AI 正文、用户气泡与正式 ThinkingIndicator

职责: 开发态 V1 Design System 参考工作区，只在 import.meta.env.DEV 下通过 /app Sidebar 暴露；空间基础卡只可视化 index.css 的生产 token，不允许创建第二套演示值。工作区与组件卡片使用纯净画布，Danger Button 是唯一允许保留实心红色功能面的组件，其余危险/错误语义不允许红色填充；Button 卡片必须直接看见独立 Saving 状态与 Shimmer。所有生产组件共用同一卡片、标题、摘要与预览结构，AI 预览直接复用生产组件，AssistantMessage 自身严禁卡片表面。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
