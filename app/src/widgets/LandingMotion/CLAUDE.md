# app/src/widgets/LandingMotion/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Landing 微动效模块职责与文档协议
CountUp.tsx: 视口触发的数字递增组件，使用 requestAnimationFrame、平缓 ease-out 与 reduced-motion 降级
ShowcaseBackdrop.tsx: APP 展示区与 AI/功能细节两处图片共用的细点阵背景；铺满各自宿主矩形，以品牌墨蓝、低透明度和慢速 warp 构成流动；Paper Shaders 按实例接近视口时加载，每处限制 90 万渲染像素，离屏/后台由库停帧，减少动态效果或无 WebGL2 时使用静态 CSS 点阵

职责: Landing 克制反馈层；CountUp 呈现数据变化，ShowcaseBackdrop 为三个产品展示面提供一致后景。一次性 reveal 归 Design System motion.ts；不提供磁吸或指针聚光，背景不截获交互、不进入 Demo 文档。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
