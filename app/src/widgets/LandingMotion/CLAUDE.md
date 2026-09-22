# app/src/widgets/LandingMotion/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Landing 微动效模块职责与文档协议
CountUp.tsx: 视口触发的数字递增组件，使用 requestAnimationFrame、平缓 ease-out 与 reduced-motion 降级
HeroBackdrop.tsx: 用户选定 02A 的正式 Hero 颗粒波面，按需加载 GrainGradient wave；尺度 .96、速度 .68、偏移 -.26/.18、方向 -17°、intensity .07、noise .19，140 万像素上限，减少动态时以 speed=0 保留静帧；78% 浓淡和 65% 阅读遮罩由 landing.css 承载，不读取 Lab 收藏
ShowcaseBackdrop.tsx: APP 展示区与功能细节图片共用的细点阵背景；铺满各自宿主矩形，以品牌墨蓝、低透明度和慢速 warp 构成流动；Paper Shaders 按实例接近视口时加载，每处限制 90 万渲染像素，离屏/后台由库停帧，减少动态效果或无 WebGL2 时使用静态 CSS 点阵

职责: Landing 克制反馈层；HeroBackdrop 承载已定稿首屏，ShowcaseBackdrop 为两个产品展示面提供一致后景，CountUp 呈现数据变化。一次性 reveal 归 Design System motion.ts；背景不截获交互，正式 Hero 不导入实验页或其持久化状态。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
