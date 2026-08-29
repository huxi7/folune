# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 Design System 工作区目录
CLAUDE.md: 记录开发态 Design System 工作区职责与文档协议
index.tsx: DesignSystemWorkspace 入口，以真实 ThemeProvider/SegmentedControl 切换 system/light/dark，再按五层信息架构陈列生产 Foundations、组件和 Signature Patterns
componentCatalog.ts: 唯一五层目录，完整登记 Color/Type/Spacing/Radius/Elevation/Motion、Primitives、Navigation & Overlays、Paper/Markdown/Reading/Quote/Code 与 Prompt Composer/Messages/Thinking/Tool/Panel Toggle/Archive Cord
iconCatalog.ts: 生产语义图标的开发态清单，按 Navigation/Content/Actions/Status/AI & Communication/Account & System 展示真实导出名与用途
ComponentTile.tsx: memo 化同构卡片，组合名称、职责、真实预览与 Default/Hover/Focus/Active/Disabled/Loading/Error/Dark/Reduced motion 统一状态检查轨
ComponentPreview.tsx: memo 化生产 token/API 预览器；复用真实 Button/Input/PasswordInput/Select/Dialog/Toast 与编辑/AI 组件，自定义表单控件由包裹 label 提供可见名称（静态检查器不穿透组件边界），不建立展示专用颜色、曲率、阴影或 Motion

职责: 开发态 Quiet Editorial Instrument 参考工作区，只在 import.meta.env.DEV 下通过 /app Sidebar 暴露；全部样板只可视化 index.css 生产 Token、组件 API 与 shared/design-system/icons 语义边界。Color 样板必须同时呈现 Primary 交互轴与 Saving Processing 状态，Typography/Spacing 样板必须同时呈现三类字族、八级文字角色、Button 36px ↔ 14/18、Tree Row/Sidebar Utility 32px ↔ 12/16 与 Input 36px ↔ 14/20 的尺寸配对，Iconography 样板必须呈现 Lucide 的 24×24 网格、2px 圆角描边、14/16/20/24px 尺寸阶梯和生产真实用途，Radius 样板必须说明各层职责；Danger Button 是唯一实心红色功能面；AI 助手正文保持无 Card；Dark 使用真实全局主题，reduced-motion 跟随系统媒体查询。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
