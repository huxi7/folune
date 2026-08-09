# app/src/widgets/LandingMotion/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Landing 微动效模块职责与文档协议
CountUp.tsx: 视口触发的数字递增组件，使用 requestAnimationFrame、平缓 ease-out 与 reduced-motion 降级
useLandingReveal.ts: Landing 区块一次性 IntersectionObserver 控制器，统一触发 3–4px、低模糊、短时淡入

职责: Landing 克制反馈层；只保留 CountUp 与一次性轻量 reveal，不提供点阵、磁吸、聚光或循环漂移装饰，颜色、速度、透明度与位移均由 index.css 和 landing.css 统一约束。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
