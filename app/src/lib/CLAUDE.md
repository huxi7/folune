# app/src/lib/
> L2 | 父级: ../CLAUDE.md

成员清单
motion.js: 全站唯一 Motion for React 动效语言，集中声明 Spring 物理参数、Apple easing、入场/退场、卡片悬停、按压、模态、路由与状态反馈变体；不承载业务状态，也不触碰 Canvas WAL/API
motion.test.ts: 动效语言契约测试，锁定阻尼范围、交互/模态变体入口与路由 Spring/短退场边界
CLAUDE.md: 记录 lib 层职责与文档协议

职责: 低层 UI 动效配置层。共享组件与页面只消费语义化变体，页面状态仍由各自模块拥有；任何 Spring 数字变化都先在这里统一调整，再检查组件和页面的运动边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
