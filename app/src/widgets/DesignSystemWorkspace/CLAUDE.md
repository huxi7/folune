# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
.gitkeep: 保留 Design System 工作区目录
CLAUDE.md: 记录开发态 Design System 工作区职责与文档协议
index.tsx: DesignSystemWorkspace 入口，以真实 ThemeProvider/SegmentedControl 切换 system/light/dark，再按五层信息架构陈列生产 Foundations、组件和 Signature Patterns
componentCatalog.ts: 唯一五层目录，完整登记 Color/Type/Spacing/Radius/Elevation/Motion、Primitives、Navigation & Overlays、Paper/Markdown/Reading/Quote/Code 与 Prompt Composer/Messages/Thinking/Tool/Panel Toggle/Archive Cord
iconCatalog.ts: 轻量生产图标示例清单，只展示能解释命名规则的代表项，并覆盖加入/缩放/连接/整理/拓展六类互不混用的稳定出口；完整导出仍由 shared/design-system/icons.tsx 维护
iconCatalog.test.tsx: 图标语义契约测试，锁定六类稳定出口全部进入 Design System 清单且实际渲染字形两两不同
ComponentTile.tsx: memo 化同构卡片，组合名称、职责与真实预览；状态直接由预览中的交互表达，不额外铺设说明轨
FoundationSpecimens.tsx: Foundations 决策样板层；用生产 token 与语义图标陈列 12px Control/9px inner 同曲线嵌套及整理/拓展 14/16px Primary/Secondary 对比
ComponentPreview.tsx: memo 化生产 token/API 综合预览器；复用 FoundationSpecimens 与真实 Button/Input/PasswordInput/Select/Dialog/Toast、编辑/AI 组件，自定义表单控件由包裹 label 提供可见名称（静态检查器不穿透组件边界），不建立展示专用颜色、曲率、阴影或 Motion

职责: 开发态 Quiet Editorial Instrument 参考工作区，只在 import.meta.env.DEV 下通过 /app Sidebar 暴露；全部样板只可视化 index.css 生产 Token、组件 API 与 shared/design-system/icons 语义边界。Color 样板必须同时呈现 Primary 交互轴与 Saving Processing 状态，Typography/Spacing 样板必须同时呈现三类字族、八级文字角色、Button 36px ↔ 14/18、Tree Row/Sidebar Utility 32px ↔ 12/16 与 Input 36px ↔ 14/20 的尺寸配对，Iconography 样板只陈列 Lucide 的 24×24 网格、2px 圆角描边、14/16/20/24px 尺寸阶梯、少量生产例子及收拢/发散语义对比；组件状态通过真实预览交互验证，不再重复铺设状态标签轨；Radius 样板必须同时显示各层职责和 12px outer/9px inner 的同曲线嵌套；Danger Button 是唯一实心红色功能面；AI 助手正文保持无 Card；Dark 使用真实全局主题，reduced-motion 跟随系统媒体查询。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
