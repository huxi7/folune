# app/src/widgets/LandingMotion/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Landing 微动效模块职责与文档协议
CountUp.tsx: 视口触发的数字递增组件，使用 requestAnimationFrame、平缓 ease-out 与 reduced-motion 降级

职责: Landing 克制反馈层；只保留 CountUp；一次性 reveal 归 Design System motion.ts 与 Landing Motion 组件，不提供点阵、磁吸、聚光或循环漂移装饰，颜色、速度由动效语义约束。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
