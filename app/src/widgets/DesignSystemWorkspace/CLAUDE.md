# app/src/widgets/DesignSystemWorkspace/
> L2 | 父级: ../CLAUDE.md

成员清单
PanelMotionSpecimen.tsx: 复用生产单一顶栏、左侧目录承接与输入浮现规则的无网络示例；可重复切换历史、创建新上下文并验证草稿保留
MotionSpecimen.tsx: 从surfaceMotionCatalog生成紧凑菜单/菜单/子菜单/工作区侧栏/模态的时长、曲线、幅度与用途表，侧栏明确展示进/退两条原曲线、scale1和外侧方向；所有交互使用真实生产组件，左右面板直接复用WorkspacePanelLayer；仅fixture本地状态，不复制展示专用参数；同时用于/motion-lab和DS Motion区
.gitkeep: 保留 Design System 工作区目录
CLAUDE.md: 记录开发态 Design System 工作区职责与文档协议
index.tsx: DesignSystemWorkspace 入口，以真实 ThemeProvider/SegmentedControl 切换 system/light/dark，再按五层信息架构陈列生产 Foundations、组件和 Signature Patterns；并独占导入 styles/design-system-workspace.css，使陈列样式随本入口一起 DEV 懒加载而不进生产 CSS
componentCatalog.ts: 唯一五层目录，BrandMark 描述与紧边界纸标/Source Serif 4 字标的 5:4 布局比及 94% 纵向光学收缩契约同步，完整登记 Color/Type/Spacing/Radius/Elevation/Motion、Primitives(含 GlowButton 墨蓝流光强调 CTA)、Navigation & Overlays、Paper/Markdown/Reading/Quote/Code 与 Prompt Composer/Messages/Thinking/Tool/Panel Toggle/Archive Cord
iconCatalog.ts: 轻量生产图标示例清单，只展示能解释命名规则的代表项，并覆盖加入/缩放/连接/整理/拓展六类互不混用的稳定出口；完整导出仍由 shared/design-system/icons.tsx 维护
iconCatalog.test.tsx: 图标语义契约测试，锁定六类稳定出口全部进入 Design System 清单且实际渲染字形两两不同
ComponentTile.tsx: memo 化同构卡片，组合名称、职责与真实预览；状态直接由预览中的交互表达，不额外铺设说明轨
FoundationSpecimens.tsx: Foundations 决策样板层；用生产 token 与语义图标陈列 16px Control/12px inner 同曲线嵌套及整理/拓展 14/16px Primary/Secondary 对比
TypographyPreview.tsx: 文字角色检视器，消费 data-text-role 并读取真实 computed size/weight/leading；字体加载、窗口缩放后重新测量，不维护数值副本
ComponentPreview.tsx: 工具执行预览使用明确 running 状态；生产组件预览器，Motion 项复用完整 MotionSpecimen，Mention 浮层消费受控 open，Toast 陈列支持可操作的倒计时撤销；颜色、曲率、材质和动效均来自生产源

职责: 开发态 Quiet Editorial Instrument 参考工作区，只在 import.meta.env.DEV 下通过 /app Sidebar 暴露；全部样板只可视化 index.css 生产 Token、组件 API 与 shared/design-system/icons 语义边界。Color 样板必须同时呈现 Primary 交互轴与 Saving Processing 状态，Typography/Spacing 样板必须同时呈现三类字族、主正文/聊天/导航/输入/动作/分组/辅助/引用等文字角色以及 400/500/600 字重、Button 36px ↔ 14/18、Tree Row/Sidebar Utility 32px ↔ 12/16 与 Input 36px ↔ 14/20 的尺寸配对，Iconography 样板只陈列 Lucide 的 24×24 网格、2px 圆角描边、14/16/20/24px 尺寸阶梯、少量生产例子及收拢/发散语义对比；组件状态通过真实预览交互验证，不再重复铺设状态标签轨；Radius 样板必须同时显示各层职责和 16px outer/12px inner 的同曲线嵌套；Danger Button 是唯一实心红色功能面；AI 助手正文保持无 Card；Dark 使用真实全局主题，reduced-motion 跟随系统媒体查询。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
