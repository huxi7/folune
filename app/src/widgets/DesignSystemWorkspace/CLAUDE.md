# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 Design System 工作区目录
CLAUDE.md: 记录开发态 Design System 工作区职责与文档协议
index.tsx: DesignSystemWorkspace 入口，以真实 ThemeProvider/SegmentedControl 切换 system/light/dark，再按五层信息架构陈列生产 Foundations、组件和 Signature Patterns
componentCatalog.ts: 唯一五层目录，完整登记 Color/Type/Spacing/Radius/Elevation/Motion、Primitives、Navigation & Overlays、Paper/Markdown/Reading/Quote/Code 与 Prompt Composer/Messages/Thinking/Tool/Panel Toggle/Archive Cord
iconCatalog.ts: 生产语义图标的开发态清单，按 Navigation/Content/Actions/Status/AI & Communication/Account & System 展示真实导出名与用途
ComponentTile.tsx: memo 化同构卡片，组合名称、职责、真实预览与 Default/Hover/Focus/Active/Disabled/Loading/Error/Dark/Reduced motion 统一状态检查轨
ComponentPreview.tsx: memo 化生产 token/API 预览器；直接可视化 Soft Ink Light/Dark、Lucide Iconography、Processing/Saving、原生 MentionInput+紧凑 @笔记结果、32px Composer 权限/发送动作与 8/10/12/16/20px 曲率职责，并复用 Button/Input/Select/Dialog/Toast、真实 CodeMirror MarkdownEditor/MarkdownReadingView、AI 消息家族和 PaperSurface/Ghost Panel Toggle/ArchiveCord，不建立展示专用颜色、曲率、阴影或 Motion

职责: 开发态 Quiet Editorial Instrument 参考工作区，只在 import.meta.env.DEV 下通过 /app Sidebar 暴露；全部样板只可视化 index.css 生产 Token、组件 API 与 shared/design-system/icons 语义边界。Color 样板必须同时呈现 Primary 交互轴与 Saving Processing 状态，Typography/Spacing 样板必须同时呈现三类字族、八级文字角色、Button 36px ↔ 14/18、Tree Row/Sidebar Utility 32px ↔ 12/16 与 Input 36px ↔ 14/20 的尺寸配对，Iconography 样板必须呈现 Lucide 的 24×24 网格、2px 圆角描边、14/16/20/24px 尺寸阶梯和生产真实用途，Radius 样板必须说明各层职责；Danger Button 是唯一实心红色功能面；AI 助手正文保持无 Card；Dark 使用真实全局主题，reduced-motion 跟随系统媒体查询。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
